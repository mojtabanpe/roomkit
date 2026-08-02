import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';
import { Tenant } from '../database/entities/tenant.entity';
import { TenantsService } from './tenants.service';

export interface RequestWithTenant extends Request {
  tenant?: Tenant;
}

/**
 * The third credential in this API, alongside the app JWT (who you are) and
 * `X-Room-Token` (you are in this room). This one proves *which platform* is
 * calling, and it belongs to that platform's backend only.
 *
 * It reads `X-Api-Key` rather than `Authorization` on purpose: sharing the
 * bearer header with `JwtAuthGuard` would mean every request had to be sniffed
 * to decide which of the two it was.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly tenants: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithTenant>();
    const raw = req.headers['x-api-key'];

    if (typeof raw !== 'string' || !raw) {
      throw new UnauthorizedException('کلید API ارسال نشده است.');
    }

    const tenant = await this.tenants.resolveKey(raw);
    if (!tenant) throw new UnauthorizedException('کلید API معتبر نیست.');

    req.tenant = tenant;
    return true;
  }
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant =>
    ctx.switchToHttp().getRequest<RequestWithTenant>().tenant as Tenant,
);
