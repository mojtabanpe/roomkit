import { Tenant } from '../database/entities/tenant.entity';
import {
  FREE_ROOM_LIMITS,
  TenantRoomPolicyService,
} from './tenant-room-policy.service';

describe('TenantRoomPolicyService', () => {
  const tenant = (overrides: Partial<Tenant> = {}): Tenant =>
    ({
      id: 'tenant-1',
      key: 'store',
      active: true,
      planMode: 'prepaid',
      maxParticipants: 100,
      ...overrides,
    }) as Tenant;

  it('applies every free-plan room limit and caps a larger request', () => {
    const service = new TenantRoomPolicyService(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(service.limits(tenant(), 50)).toEqual({
      ...FREE_ROOM_LIMITS,
      maxParticipants: 10,
    });
  });

  it('does not raise a tenant ceiling that is already below the free limit', () => {
    const service = new TenantRoomPolicyService(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(service.limits(tenant({ maxParticipants: 6 })).maxParticipants).toBe(
      6,
    );
  });

  it('keeps the pro plan at its tenant participant ceiling', () => {
    const service = new TenantRoomPolicyService(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(
      service.limits(
        tenant({ planMode: 'unlimited', maxParticipants: 300 }),
        500,
      ),
    ).toEqual({
      maxParticipants: 300,
      maxDurationSeconds: null,
      video: null,
    });
  });

  it('rejects another join after a free room has run for 30 minutes', async () => {
    const events = {
      findOne: jest.fn().mockResolvedValue({
        startedAt: new Date('2026-08-14T08:00:00.000Z'),
      }),
    };
    const balances = { findOne: jest.fn() };
    const service = new TenantRoomPolicyService(
      {} as never,
      balances as never,
      events as never,
    );

    await expect(
      service.admission(
        tenant(),
        'store~daily',
        new Date('2026-08-14T08:30:00.000Z'),
      ),
    ).resolves.toEqual({ allowed: false, reason: 'duration_exceeded' });
    expect(balances.findOne).not.toHaveBeenCalled();
  });
});
