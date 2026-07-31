import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { AuthUser } from './auth.service';
import { RequestWithUser } from './jwt-auth.guard';

export const IS_OPTIONAL_AUTH = 'isOptionalAuth';

/** Allow anonymous callers through; `@CurrentUser()` may be undefined. */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<RequestWithUser>().user,
);
