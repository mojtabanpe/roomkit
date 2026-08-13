import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { TenantBalance } from '../database/entities/tenant-balance.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { UsageEvent } from '../database/entities/usage-event.entity';
import { RoomConnectionLimits } from '../livekit/livekit.service';

export const FREE_ROOM_LIMITS: Readonly<RoomConnectionLimits> = {
  maxParticipants: 10,
  maxDurationSeconds: 30 * 60,
  video: {
    width: 854,
    height: 480,
    frameRate: 24,
    maxBitrate: 700_000,
  },
};

export type RoomAdmission =
  | { allowed: true }
  | { allowed: false; reason: 'balance_exhausted' | 'duration_exceeded' };

@Injectable()
export class TenantRoomPolicyService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantBalance)
    private readonly balances: Repository<TenantBalance>,
    @InjectRepository(UsageEvent)
    private readonly events: Repository<UsageEvent>,
  ) {}

  limits(
    tenant: Pick<Tenant, 'planMode' | 'maxParticipants'>,
    requestedParticipants?: number | null,
  ): RoomConnectionLimits {
    const planLimit =
      tenant.planMode === 'prepaid'
        ? tenant.maxParticipants === null
          ? FREE_ROOM_LIMITS.maxParticipants
          : Math.min(
              FREE_ROOM_LIMITS.maxParticipants ?? tenant.maxParticipants,
              tenant.maxParticipants,
            )
        : tenant.maxParticipants;
    const requested = requestedParticipants ?? null;
    const maxParticipants =
      planLimit === null
        ? requested
        : requested === null
          ? planLimit
          : Math.min(planLimit, requested);

    return tenant.planMode === 'prepaid'
      ? { ...FREE_ROOM_LIMITS, maxParticipants }
      : {
          maxParticipants,
          maxDurationSeconds: null,
          video: null,
        };
  }

  async admission(
    tenant: Tenant,
    room: string,
    now = new Date(),
  ): Promise<RoomAdmission> {
    const limits = this.limits(tenant);
    if (limits.maxDurationSeconds !== null) {
      const session = await this.events.findOne({
        where: {
          tenantId: tenant.id,
          room,
          kind: 'room',
          endedAt: IsNull(),
        },
        order: { startedAt: 'ASC' },
      });
      if (
        session &&
        now.getTime() - session.startedAt.getTime() >=
          limits.maxDurationSeconds * 1000
      ) {
        return { allowed: false, reason: 'duration_exceeded' };
      }
    }

    if (tenant.planMode === 'unlimited') return { allowed: true };
    const balance = await this.balances.findOne({
      where: { tenantId: tenant.id },
    });
    if (
      !balance ||
      balance.usedUnits >= balance.includedUnits + balance.creditLimitUnits
    ) {
      return { allowed: false, reason: 'balance_exhausted' };
    }
    return { allowed: true };
  }

  async expiredRooms(tenant: Tenant, now = new Date()): Promise<string[]> {
    const { maxDurationSeconds } = this.limits(tenant);
    if (maxDurationSeconds === null) return [];

    const cutoff = new Date(now.getTime() - maxDurationSeconds * 1000);
    const sessions = await this.events.find({
      where: {
        tenantId: tenant.id,
        kind: 'room',
        endedAt: IsNull(),
        startedAt: LessThanOrEqual(cutoff),
      },
      select: { room: true },
    });
    return [...new Set(sessions.map((session) => session.room))];
  }

  async expiredRoomsForTenant(
    tenantId: string,
    now = new Date(),
  ): Promise<{ tenant: Tenant; rooms: string[] } | null> {
    const tenant = await this.tenants.findOne({
      where: { id: tenantId, active: true },
    });
    if (!tenant) return null;
    return { tenant, rooms: await this.expiredRooms(tenant, now) };
  }
}
