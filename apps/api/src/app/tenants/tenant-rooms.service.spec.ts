import { NotFoundException } from '@nestjs/common';
import { TenantRoomsService } from './tenant-rooms.service';

describe('TenantRoomsService', () => {
  it('does not expose rooms for an unknown tenant key', async () => {
    const tenants = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new TenantRoomsService(
      {} as never,
      tenants as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.publicView('missing', 'room')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
