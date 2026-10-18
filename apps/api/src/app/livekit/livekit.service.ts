import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  ParticipantInfo,
  RoomServiceClient,
  TrackSource,
  TwirpError,
  VideoGrant,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';

export interface JoinTokenRequest {
  /** Room the participant will join. Created on demand by LiveKit. */
  room: string;
  /** Stable, unique identity for the participant. */
  identity: string;
  /** Optional human-readable display name. */
  name?: string;
  /** Viewer-only plans mint tokens that cannot publish. */
  canPublish?: boolean;
  /** Narrows `canPublish` to these sources; omitted means every source. */
  publishSources?: TrackSource[];
  /** Product limits the client must apply when publishing media. */
  limits?: RoomConnectionLimits;
}

export interface RoomConnectionLimits {
  maxParticipants: number | null;
  maxDurationSeconds: number | null;
  video: {
    width: number;
    height: number;
    frameRate: number;
    maxBitrate: number;
  } | null;
}

export interface JoinTokenResponse {
  token: string;
  serverUrl: string;
  room: string;
  identity: string;
  limits?: RoomConnectionLimits;
}

@Injectable()
export class LivekitService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Mint a join token for a participant. The token encodes the room and the
   * permissions (publish + subscribe) needed for a video conference.
   *
   * See https://docs.livekit.io/home/get-started/authentication for the token
   * model and `lk docs get-page /home/server/generating-tokens` for grants.
   */
  async createJoinToken(req: JoinTokenRequest): Promise<JoinTokenResponse> {
    const { apiKey, apiSecret, serverUrl } = this.credentials();

    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.identity,
      name: req.name,
      // Tokens are only validated on the initial connection.
      ttl: '1h',
    });

    const grant: VideoGrant = {
      room: req.room,
      roomJoin: true,
      canPublish: req.canPublish ?? true,
      canSubscribe: true,
      canPublishData: true,
    };
    if (grant.canPublish && req.publishSources?.length) {
      grant.canPublishSources = req.publishSources;
    }
    at.addGrant(grant);

    const token = await at.toJwt();

    return {
      token,
      serverUrl,
      room: req.room,
      identity: req.identity,
      ...(req.limits ? { limits: req.limits } : {}),
    };
  }

  /**
   * Create the room up front so its ceilings are set by the *server*, not by
   * whatever the client asks for. A room LiveKit auto-creates on first join has
   * no participant limit at all.
   */
  async ensureRoom(name: string, maxParticipants?: number | null) {
    const [existing] = await this.roomAdmin().listRooms([name]);
    if (existing) return existing;
    await this.roomAdmin().createRoom({
      name,
      ...(maxParticipants ? { maxParticipants } : {}),
    });
  }

  async activeParticipantCount(name: string): Promise<number> {
    const [room] = await this.roomAdmin().listRooms([name]);
    return room?.numParticipants ?? 0;
  }

  async mutePublishedTrack(
    room: string,
    identity: string,
    trackSid: string,
  ): Promise<void> {
    await this.roomAdmin().mutePublishedTrack(room, identity, trackSid, true);
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    await this.roomAdmin().removeParticipant(room, identity);
  }

  /** Who is connected right now. A room nobody has opened yet has no one in it. */
  async listParticipants(room: string): Promise<ParticipantInfo[]> {
    try {
      return await this.roomAdmin().listParticipants(room);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  /** `null` when the participant is not in the room — the caller decides what that means. */
  async getParticipant(
    room: string,
    identity: string,
  ): Promise<ParticipantInfo | null> {
    try {
      return await this.roomAdmin().getParticipant(room, identity);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * Mutes what `identity` is sending from the given sources. Muting is the
   * server's say, but unmuting stays the participant's: LiveKit lets a client
   * reopen its own track, which is why taking away the right to speak is
   * `setPublishSources`, not this.
   */
  async muteSources(
    room: string,
    identity: string,
    sources: TrackSource[],
  ): Promise<number | null> {
    const participant = await this.getParticipant(room, identity);
    if (!participant) return null;
    const targets = participant.tracks.filter(
      (track) => !track.muted && sources.includes(track.source),
    );
    for (const track of targets) {
      await this.roomAdmin().mutePublishedTrack(
        room,
        identity,
        track.sid,
        true,
      );
    }
    return targets.length;
  }

  /**
   * Changes what a connected participant may publish, without a new token and
   * without a reconnect. An empty list takes publishing away entirely; LiveKit
   * itself unpublishes any track whose source is no longer allowed.
   *
   * LiveKit replaces the permission as a whole, so the fields this call is not
   * about are carried over from the participant's current grant — otherwise
   * granting a microphone would quietly take away chat (`canPublishData`).
   */
  async setPublishSources(
    room: string,
    identity: string,
    sources: TrackSource[],
  ): Promise<ParticipantInfo | null> {
    const participant = await this.getParticipant(room, identity);
    if (!participant) return null;
    const current = participant.permission;
    return this.roomAdmin().updateParticipant(room, identity, {
      permission: {
        canSubscribe: current?.canSubscribe ?? true,
        canPublishData: current?.canPublishData ?? true,
        canUpdateMetadata: current?.canUpdateMetadata ?? false,
        hidden: current?.hidden ?? false,
        canPublish: sources.length > 0,
        canPublishSources: sources,
      },
    });
  }

  /** Ends a call for everyone in it — how a spent tenant gets cut off. */
  async closeRoom(name: string): Promise<void> {
    await this.roomAdmin().deleteRoom(name);
  }

  async listRoomNames(prefix: string): Promise<string[]> {
    const rooms = await this.roomAdmin().listRooms();
    return rooms.map((r) => r.name).filter((n) => n.startsWith(prefix));
  }

  /**
   * Verify a webhook delivery. `body` must be the raw request string — parsing
   * it to JSON first loses the exact bytes the signature covers.
   */
  async receiveWebhook(
    body: string,
    authHeader?: string,
  ): Promise<WebhookEvent> {
    const { apiKey, apiSecret } = this.credentials();
    return new WebhookReceiver(apiKey, apiSecret).receive(body, authHeader);
  }

  private roomAdmin(): RoomServiceClient {
    const { apiKey, apiSecret, serverUrl } = this.credentials();
    // RoomServiceClient speaks HTTP, not the websocket signalling URL.
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    return new RoomServiceClient(httpUrl, apiKey, apiSecret);
  }

  private credentials(): {
    apiKey: string;
    apiSecret: string;
    serverUrl: string;
  } {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const serverUrl = this.config.get<string>('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new InternalServerErrorException(
        'LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL.',
      );
    }
    return { apiKey, apiSecret, serverUrl };
  }
}

/** LiveKit answers 404 for a room that does not exist and a participant who is not in it. */
function isNotFound(error: unknown): boolean {
  return error instanceof TwirpError && error.status === 404;
}
