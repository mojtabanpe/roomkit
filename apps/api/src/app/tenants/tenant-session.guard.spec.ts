import { UnauthorizedException } from '@nestjs/common';
import { TenantSessionGuard } from './tenant-session.guard';

describe('TenantSessionGuard', () => {
  it('rejects requests without a tenant bearer token', async () => {
    const guard = new TenantSessionGuard({} as never, {} as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
