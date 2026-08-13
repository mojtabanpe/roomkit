import { UnauthorizedException } from '@nestjs/common';
import { TenantAuthService } from './tenant-auth.service';

describe('TenantAuthService', () => {
  it('does not reveal whether a tenant email exists', async () => {
    const tenants = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new TenantAuthService(tenants as never, {} as never);
    await expect(
      service.login({ email: 'missing@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
