import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { UsageEvent } from '../database/entities/usage-event.entity';
import { LivekitService } from '../livekit/livekit.service';
import { parseLivekitRoomName } from '../tenants/room-name';

/** How often open stays are charged forward and over-limit tenants cut off. */
const DEFAULT_SWEEP_SECONDS = 60;

export interface BalanceView {
  planMode: Tenant['planMode'];
  includedUnits: number;
  usedUnits: number;
  creditLimitUnits: number;
  /** Null when the plan is `unlimited` — there is nothing left to run out of. */
  remainingUnits: number | null;
}

/**
 * Owns billable usage: what a tenant has spent, and cutting them off when it
 * runs out.
 *
 * The single instance assumption: the sweep is guarded by an in-process flag,
 * which is enough because `deploy/compose.prod.yaml` runs one `api` container.
 * Running two would double-charge — an advisory lock has to come first.
 */
@Injectable()
export class UsageService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(UsageService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @InjectRepository(UsageEvent)
    private readonly events: Repository<UsageEvent>,
    @InjectRepository(TenantBalance)
    private readonly balances: Repository<TenantBalance>,
    private readonly dataSource: DataSource,
    private readonly livekit: LivekitService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const seconds =
      Number(this.config.get('USAGE_SWEEP_SECONDS')) || DEFAULT_SWEEP_SECONDS;
    this.timer = setInterval(() => {
      this.sweep().catch((err) => this.log.error('usage sweep failed', err));
    }, seconds * 1000);
    // Do not hold the process open in tests or short-lived CLI runs.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Whether a tenant may start another participant. `unlimited` always can;
   * the other two share one rule, because prepaid is simply pay-as-you-go with
   * a credit limit of zero.
   */
  async canAdmit(tenant: Tenant): Promise<boolean> {
    if (tenant.planMode === 'unlimited') return true;
    const balance = await this.balances.findOne({
      where: { tenantId: tenant.id },
    });
    if (!balance) return false;
    return balance.usedUnits < balance.includedUnits + balance.creditLimitUnits;
  }

  async balanceOf(tenant: Tenant): Promise<BalanceView> {
    const balance =
      (await this.balances.findOne({ where: { tenantId: tenant.id } })) ??
      this.balances.create({ tenantId: tenant.id });

    return {
      planMode: tenant.planMode,
      includedUnits: balance.includedUnits,
      usedUnits: balance.usedUnits,
      creditLimitUnits: balance.creditLimitUnits,
      remainingUnits:
        tenant.planMode === 'unlimited'
          ? null
          : balance.includedUnits + balance.creditLimitUnits - balance.usedUnits,
    };
  }

  /**
   * Record a participant arriving. Idempotent on the LiveKit sid, because
   * LiveKit retries webhook deliveries and promises nothing about duplicates.
   */
  async openStay(input: {
    tenantId: string | null;
    room: string;
    identity: string;
    sourceSid: string;
    startedAt: Date;
  }): Promise<void> {
    await this.events
      .createQueryBuilder()
      .insert()
      .values({
        tenantId: input.tenantId,
        room: input.room,
        identity: input.identity,
        sourceSid: input.sourceSid,
        kind: 'participant',
        startedAt: input.startedAt,
        billedUntil: input.startedAt,
        units: 0,
      })
      .orIgnore()
      .execute();
  }

  /** Charge the last slice and close one participant's stay. */
  async closeStay(sourceSid: string, endedAt: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(UsageEvent, {
        where: { sourceSid, endedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) return;
      await this.chargeSlice(manager, event, endedAt);
      await manager.update(UsageEvent, { id: event.id }, { endedAt });
    });
  }

  /** Close every stay still open in a room — LiveKit's `room_finished`. */
  async closeRoom(room: string, endedAt: Date): Promise<void> {
    const open = await this.events.find({
      where: { room, endedAt: IsNull() },
      select: { sourceSid: true },
    });
    for (const event of open) {
      await this.closeStay(event.sourceSid, endedAt);
    }
  }

  /**
   * Charge every open stay up to now, then cut off whoever has run out.
   *
   * Charging only on `participant_left` is not enough: a tenant whose balance
   * hits zero mid-call would keep the room for as long as the participants
   * stayed, and the overdraft would only be discovered once it was unbillable.
   */
  async sweep(now = new Date()): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const open = await this.events.find({ where: { endedAt: IsNull() } });

      const touched = new Set<string>();
      for (const event of open) {
        await this.dataSource.transaction(async (manager) => {
          const fresh = await manager.findOne(UsageEvent, {
            where: { id: event.id, endedAt: IsNull() },
            lock: { mode: 'pessimistic_write' },
          });
          if (!fresh) return;
          await this.chargeSlice(manager, fresh, now);
        });
        if (event.tenantId) touched.add(event.tenantId);
      }

      for (const tenantId of touched) {
        await this.evictIfSpent(tenantId);
      }
    } finally {
      this.sweeping = false;
    }
  }

  /**
   * Bill the time between the event's watermark and `until`, then move the
   * watermark. Doing it as a watermark rather than "now minus startedAt" is
   * what makes a repeated or overlapping sweep harmless.
   */
  private async chargeSlice(
    manager: EntityManager,
    event: UsageEvent,
    until: Date,
  ): Promise<void> {
    const seconds = Math.floor(
      (until.getTime() - event.billedUntil.getTime()) / 1000,
    );
    if (seconds <= 0) return;

    await manager.increment(UsageEvent, { id: event.id }, 'units', seconds);
    await manager.update(UsageEvent, { id: event.id }, { billedUntil: until });

    // First-party rooms are metered for reporting but nobody is billed.
    if (event.tenantId) {
      await manager.increment(
        TenantBalance,
        { tenantId: event.tenantId },
        'usedUnits',
        seconds,
      );
    }
  }

  private async evictIfSpent(tenantId: string): Promise<void> {
    const balance = await this.balances.findOne({
      where: { tenantId },
      relations: { tenant: true },
    });
    if (!balance?.tenant || balance.tenant.planMode === 'unlimited') return;
    if (balance.usedUnits < balance.includedUnits + balance.creditLimitUnits) {
      return;
    }

    const rooms = await this.events
      .createQueryBuilder('e')
      .select('DISTINCT e.room', 'room')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.endedAt IS NULL')
      .getRawMany<{ room: string }>();

    for (const { room } of rooms) {
      // Belt and braces: never close a room that is not this tenant's.
      if (parseLivekitRoomName(room).tenantKey !== balance.tenant.key) continue;
      try {
        await this.livekit.closeRoom(room);
        this.log.warn(`closed ${room}: tenant ${tenantId} is out of balance`);
      } catch (err) {
        this.log.error(`could not close ${room}`, err);
      }
    }
  }
}
