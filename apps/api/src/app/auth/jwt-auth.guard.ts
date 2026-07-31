import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser, AuthService } from './auth.service';
import { IS_OPTIONAL_AUTH } from './optional-auth.decorator';

export interface RequestWithUser extends Request {
  user?: AuthUser;
}

/**
 * Verifies the bearer token and attaches the user.
 *
 * Routes marked `@OptionalAuth()` still run for anonymous callers — the app
 * lets guests join rooms, so most endpoints must work with `req.user`
 * undefined rather than rejecting.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const optional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(req);

    if (!token) {
      if (optional) return true;
      throw new UnauthorizedException('برای این کار باید وارد شوید.');
    }

    try {
      const payload = this.jwt.verify<{ sub: string }>(token);
      const user = await this.auth.findById(payload.sub);
      if (!user) throw new Error('unknown user');
      req.user = user;
      return true;
    } catch {
      if (optional) return true; // a stale token must not lock guests out
      throw new UnauthorizedException('نشست شما منقضی شده است.');
    }
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
  }
}
