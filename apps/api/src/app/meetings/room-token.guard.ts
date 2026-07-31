import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { TokenVerifier } from 'livekit-server-sdk';

export interface RoomClaims {
  room: string;
  identity: string;
  name: string;
}

interface RequestWithRoom extends Request {
  roomClaims?: RoomClaims;
}

/**
 * Proves the caller is actually in the room they claim to be writing to, by
 * verifying the LiveKit join token we minted for them. Without this, anyone
 * could POST chat into any room by guessing its slug.
 */
@Injectable()
export class RoomTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithRoom>();
    const token = req.headers['x-room-token'];

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('توکن اتاق ارسال نشده است.');
    }

    const verifier = new TokenVerifier(
      this.config.getOrThrow<string>('LIVEKIT_API_KEY'),
      this.config.getOrThrow<string>('LIVEKIT_API_SECRET'),
    );

    let claims;
    try {
      claims = await verifier.verify(token);
    } catch {
      throw new UnauthorizedException('توکن اتاق معتبر نیست.');
    }

    const room = claims.video?.room;
    const identity = claims.sub;
    if (!room || !identity || !claims.video?.roomJoin) {
      throw new UnauthorizedException('توکن اتاق معتبر نیست.');
    }

    req.roomClaims = { room, identity, name: claims.name || identity };
    return true;
  }
}

export const RoomCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RoomClaims =>
    ctx.switchToHttp().getRequest<RequestWithRoom>().roomClaims as RoomClaims,
);
