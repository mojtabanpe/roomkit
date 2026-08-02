import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { ApiKey } from '../database/entities/api-key.entity';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { PlanMode, Tenant } from '../database/entities/tenant.entity';

/** Every key we mint is `rk_live_<prefix>.<secret>`. */
const KEY_NAMESPACE = 'rk_live_';

/**
 * How often a key's `lastUsedAt` is refreshed. Writing it on every request
 * would turn a read-only auth check into a write on the hot path.
 */
const LAST_USED_REFRESH_MS = 60_000;

export interface IssuedKey {
  id: string;
  prefix: string;
  /** The only time the full key exists. It is never stored or recoverable. */
  key: string;
}

export interface TenantSummary {
  id: string;
  key: string;
  name: string;
  planMode: PlanMode;
  active: boolean;
  maxParticipants: number | null;
  createdAt: Date;
  includedUnits: number;
  usedUnits: number;
  creditLimitUnits: number;
  /** Null under `unlimited` — there is nothing left to run out of. */
  remainingUnits: number | null;
}

export interface KeySummary {
  id: string;
  prefix: string;
  label: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TenantDetail extends TenantSummary {
  keys: KeySummary[];
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(ApiKey) private readonly keys: Repository<ApiKey>,
    @InjectRepository(TenantBalance)
    private readonly balances: Repository<TenantBalance>,
  ) {}

  async createTenant(input: {
    key: string;
    name: string;
    planMode: PlanMode;
    maxParticipants?: number | null;
  }): Promise<Tenant> {
    const tenant = await this.tenants.save(
      this.tenants.create({
        key: input.key,
        name: input.name,
        planMode: input.planMode,
        maxParticipants: input.maxParticipants ?? null,
      }),
    );
    // A tenant with no balance row would divide-by-zero its way past every
    // quota check, so the row is created with the tenant, not on first use.
    await this.balances.save(this.balances.create({ tenantId: tenant.id }));
    return tenant;
  }

  async findByKey(key: string): Promise<Tenant | null> {
    return this.tenants.findOne({ where: { key } });
  }

  /**
   * Tenants with their balances, for the admin panel. One query rather than one
   * per row — the panel lists every platform at once.
   */
  async listTenants(): Promise<TenantSummary[]> {
    const tenants = await this.tenants.find({ order: { createdAt: 'DESC' } });
    if (tenants.length === 0) return [];

    const balances = await this.balances.find({
      where: tenants.map((t) => ({ tenantId: t.id })),
    });
    const byTenant = new Map(balances.map((b) => [b.tenantId, b]));

    return tenants.map((tenant) => summarise(tenant, byTenant.get(tenant.id)));
  }

  async getTenant(id: string): Promise<TenantDetail> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('مستأجر پیدا نشد.');

    const balance = await this.balances.findOne({ where: { tenantId: id } });
    const keys = await this.keys.find({
      where: { tenantId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...summarise(tenant, balance ?? undefined),
      // Never the secret — it does not exist here to leak.
      keys: keys.map((key) => ({
        id: key.id,
        prefix: key.prefix,
        label: key.label,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      })),
    };
  }

  async updateTenant(
    id: string,
    patch: {
      name?: string;
      planMode?: PlanMode;
      maxParticipants?: number | null;
      active?: boolean;
    },
  ): Promise<TenantSummary> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('مستأجر پیدا نشد.');

    Object.assign(tenant, patch);
    await this.tenants.save(tenant);

    const balance = await this.balances.findOne({ where: { tenantId: id } });
    return summarise(tenant, balance ?? undefined);
  }

  /**
   * Grant billable seconds. For prepaid this is the top-up; for the other plans
   * it raises the monthly allowance.
   */
  async topUp(tenantId: string, units: number): Promise<TenantBalance> {
    if (!(await this.tenants.existsBy({ id: tenantId }))) {
      throw new NotFoundException('مستأجر پیدا نشد.');
    }
    await this.balances.increment({ tenantId }, 'includedUnits', units);
    return this.balances.findOneOrFail({ where: { tenantId } });
  }

  async setCreditLimit(
    tenantId: string,
    units: number,
  ): Promise<TenantBalance> {
    await this.balances.update({ tenantId }, { creditLimitUnits: units });
    return this.balances.findOneOrFail({ where: { tenantId } });
  }

  /**
   * Mint a key. The secret half is 32 random bytes; the prefix is what we index
   * on, so a lookup never has to scan and hash every row.
   */
  async issueKey(tenantId: string, label: string): Promise<IssuedKey> {
    if (!(await this.tenants.existsBy({ id: tenantId }))) {
      throw new NotFoundException('مستأجر پیدا نشد.');
    }
    const prefix = KEY_NAMESPACE + randomBytes(8).toString('hex');
    const secret = randomBytes(32).toString('base64url');

    const row = await this.keys.save(
      this.keys.create({
        tenantId,
        prefix,
        secretHash: sha256(secret),
        label,
      }),
    );
    return { id: row.id, prefix, key: `${prefix}.${secret}` };
  }

  async revokeKey(tenantId: string, keyId: string): Promise<void> {
    const row = await this.keys.findOne({ where: { id: keyId, tenantId } });
    if (!row) throw new NotFoundException('کلید پیدا نشد.');
    row.revokedAt = new Date();
    await this.keys.save(row);
  }

  /**
   * Resolve a raw key to its tenant, or null. Returns null for every failure
   * mode — unknown prefix, wrong secret, revoked key, suspended tenant — so a
   * caller cannot tell them apart by probing.
   */
  async resolveKey(raw: string): Promise<Tenant | null> {
    const dot = raw.indexOf('.');
    if (dot === -1) return null;
    const prefix = raw.slice(0, dot);
    const secret = raw.slice(dot + 1);
    if (!prefix.startsWith(KEY_NAMESPACE) || !secret) return null;

    const row = await this.keys.findOne({
      where: { prefix },
      relations: { tenant: true },
    });
    if (!row || row.revokedAt) return null;
    if (!constantTimeEquals(row.secretHash, sha256(secret))) return null;
    if (!row.tenant?.active) return null;

    const stale =
      !row.lastUsedAt ||
      Date.now() - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS;
    if (stale) {
      await this.keys.update({ id: row.id }, { lastUsedAt: new Date() });
    }
    return row.tenant;
  }
}

/**
 * A tenant with no balance row reads as all-zeroes rather than throwing.
 * `createTenant` always makes one, so this only covers rows predating it.
 */
function summarise(tenant: Tenant, balance?: TenantBalance): TenantSummary {
  const included = balance?.includedUnits ?? 0;
  const used = balance?.usedUnits ?? 0;
  const creditLimit = balance?.creditLimitUnits ?? 0;

  return {
    id: tenant.id,
    key: tenant.key,
    name: tenant.name,
    planMode: tenant.planMode,
    active: tenant.active,
    maxParticipants: tenant.maxParticipants,
    createdAt: tenant.createdAt,
    includedUnits: included,
    usedUnits: used,
    creditLimitUnits: creditLimit,
    remainingUnits:
      tenant.planMode === 'unlimited' ? null : included + creditLimit - used,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
