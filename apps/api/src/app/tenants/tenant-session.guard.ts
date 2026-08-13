import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TenantAuthService, TenantSession } from './tenant-auth.service';

interface RequestWithTenantSession extends Request {
  tenantSession?: TenantSession;
}

export const CurrentTenantSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantSession => {
    const tenant = context
      .switchToHttp()
      .getRequest<RequestWithTenantSession>().tenantSession;
    if (!tenant) throw new UnauthorizedException('نشست tenant در دسترس نیست.');
    return tenant;
  },
);

@Injectable()
export class TenantSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: TenantAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithTenantSession>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'برای این کار باید وارد پنل tenant شوید.',
      );
    }
    try {
      const payload = this.jwt.verify<{ sub: string; kind?: string }>(
        header.slice(7).trim(),
      );
      if (payload.kind !== 'tenant') throw new Error('wrong session kind');
      const tenant = await this.auth.findById(payload.sub);
      if (!tenant) throw new Error('unknown tenant');
      request.tenantSession = tenant;
      return true;
    } catch {
      throw new UnauthorizedException('نشست tenant منقضی شده است.');
    }
  }
}
