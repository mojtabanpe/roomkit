import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Guards tenant onboarding. There is no admin UI yet, so this is a single
 * shared secret in `ADMIN_TOKEN` — deliberately the smallest thing that can
 * create a tenant without leaving the endpoint open.
 *
 * Fails closed: with `ADMIN_TOKEN` unset nobody gets in, rather than everybody.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_TOKEN');
    if (!expected) {
      throw new UnauthorizedException('مدیریت مستأجرها فعال نیست.');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const given = req.headers['x-admin-token'];
    if (typeof given !== 'string' || !equals(given, expected)) {
      throw new UnauthorizedException('توکن مدیریت معتبر نیست.');
    }
    return true;
  }
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
