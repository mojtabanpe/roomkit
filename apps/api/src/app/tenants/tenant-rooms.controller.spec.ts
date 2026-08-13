import { TenantRoomsController } from './tenant-rooms.controller';

describe('TenantRoomsController', () => {
  it('uses the tenant id from the tenant session when listing rooms', async () => {
    const rooms = { list: jest.fn().mockResolvedValue([]) };
    const controller = new TenantRoomsController(rooms as never);
    await expect(
      controller.list({ id: 'tenant-id' } as never),
    ).resolves.toEqual([]);
    expect(rooms.list).toHaveBeenCalledWith('tenant-id');
  });
});
