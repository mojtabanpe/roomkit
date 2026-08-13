import { TenantAuthController } from './tenant-auth.controller';

describe('TenantAuthController', () => {
  it('delegates tenant login to the auth service', async () => {
    const result = { token: 'token', tenant: { id: '1' } };
    const auth = { login: jest.fn().mockResolvedValue(result) };
    const controller = new TenantAuthController(auth as never);
    await expect(
      controller.login({ email: 'tenant@example.com', password: 'secret' }),
    ).resolves.toBe(result);
  });
});
