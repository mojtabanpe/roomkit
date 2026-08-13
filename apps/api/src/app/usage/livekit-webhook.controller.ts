import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TrackSource, TrackType } from 'livekit-server-sdk';
import { Tenant } from '../database/entities/tenant.entity';
import { LivekitService } from '../livekit/livekit.service';
import { parseLivekitRoomName } from '../tenants/room-name';
import { TenantRoomPolicyService } from '../tenants/tenant-room-policy.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsageService } from './usage.service';

/** Path the LiveKit server posts to. Mirrored in `deploy/livekit/livekit.yaml`. */
export const WEBHOOK_PATH = 'livekit/webhook';

@Controller(WEBHOOK_PATH)
export class LivekitWebhookController {
  private readonly log = new Logger(LivekitWebhookController.name);

  constructor(
    private readonly livekit: LivekitService,
    private readonly tenants: TenantsService,
    private readonly usage: UsageService,
    private readonly policies: TenantRoomPolicyService,
  ) {}

  /**
   * The only source of billable usage. The signature covers the exact bytes
   * LiveKit sent, so this handler needs the raw body — see the `express.raw`
   * mount for this path in `main.ts`.
   */
  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request): Promise<{ ok: true }> {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
    if (!raw) {
      throw new BadRequestException('raw webhook body missing');
    }

    // A bad signature must be 401, not a 500: LiveKit retries 5xx, so an
    // unverifiable delivery would come back forever and bury real errors.
    let event: Awaited<ReturnType<LivekitService['receiveWebhook']>>;
    try {
      event = await this.livekit.receiveWebhook(raw, req.get('Authorization'));
    } catch {
      throw new UnauthorizedException('امضای webhook معتبر نیست.');
    }

    const at = toDate(event.createdAt);
    const room = event.room?.name;

    switch (event.event) {
      case 'participant_joined': {
        if (!room || !event.participant) break;
        const tenant = await this.tenantFor(room);
        const maxParticipants = tenant
          ? this.policies.limits(tenant).maxParticipants
          : null;
        if (
          maxParticipants !== null &&
          (await this.livekit.activeParticipantCount(room)) > maxParticipants
        ) {
          await this.livekit.removeParticipant(
            room,
            event.participant.identity,
          );
          this.log.warn(
            `removed ${event.participant.identity} from ${room}: participant limit reached`,
          );
          break;
        }
        if (tenant && event.room?.sid) {
          await this.usage.openRoom({
            tenantId: tenant.id,
            room,
            sourceSid: event.room.sid,
            startedAt: toDate(event.participant.joinedAt),
          });
        }
        await this.usage.openStay({
          tenantId: tenant?.id ?? null,
          room,
          identity: event.participant.identity,
          sourceSid: event.participant.sid,
          startedAt: toDate(event.participant.joinedAt),
        });
        break;
      }
      case 'track_published': {
        if (!room || !event.participant || !event.track) break;
        const tenant = await this.tenantFor(room);
        const video = tenant ? this.policies.limits(tenant).video : null;
        if (
          video &&
          event.track.type === TrackType.VIDEO &&
          event.track.source === TrackSource.CAMERA &&
          exceedsVideoLimit(event.track.width, event.track.height, video)
        ) {
          await this.livekit.mutePublishedTrack(
            room,
            event.participant.identity,
            event.track.sid,
          );
          this.log.warn(
            `muted ${event.track.sid} in ${room}: free camera exceeds 480p`,
          );
        }
        break;
      }
      case 'participant_left':
      case 'participant_connection_aborted': {
        if (!event.participant) break;
        await this.usage.closeStay(event.participant.sid, at);
        break;
      }
      case 'room_finished': {
        if (!room) break;
        await this.usage.closeRoom(room, at);
        break;
      }
      default:
        break;
    }

    return { ok: true };
  }

  /** Null for first-party rooms, and for a prefix no live tenant claims. */
  private async tenantFor(room: string): Promise<Tenant | null> {
    const { tenantKey } = parseLivekitRoomName(room);
    if (!tenantKey) return null;
    const tenant = await this.tenants.findByKey(tenantKey);
    if (!tenant) {
      this.log.warn(`webhook for unknown tenant key "${tenantKey}"`);
      return null;
    }
    return tenant;
  }
}

function exceedsVideoLimit(
  width: number,
  height: number,
  limit: { width: number; height: number },
): boolean {
  if (width <= 0 || height <= 0) return false;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  return (
    longEdge > Math.max(limit.width, limit.height) ||
    shortEdge > Math.min(limit.width, limit.height)
  );
}

/** Protobuf timestamps arrive as bigint seconds. */
function toDate(seconds: bigint | number | undefined): Date {
  const value = Number(seconds ?? 0);
  return value > 0 ? new Date(value * 1000) : new Date();
}
