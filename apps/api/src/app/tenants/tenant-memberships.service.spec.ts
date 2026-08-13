import { TenantMembershipsService } from './tenant-memberships.service';

describe('TenantMembershipsService', () => {
  it('reports usernames that do not belong to registered users', async () => {
    const members = {};
    const users = { find: jest.fn().mockResolvedValue([]) };
    const service = new TenantMembershipsService(
      members as never,
      users as never,
    );
    await expect(service.add('tenant-id', ['unknown'])).resolves.toEqual({
      added: [],
      notFound: ['unknown'],
      unavailable: [],
    });
  });
});
