import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
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
}

export interface JoinTokenResponse {
  token: string;
  serverUrl: string;
  room: string;
  identity: string;
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
    at.addGrant(grant);

    const token = await at.toJwt();

    return { token, serverUrl, room: req.room, identity: req.identity };
  }

  /**
   * Create the room up front so its ceilings are set by the *server*, not by
   * whatever the client asks for. A room LiveKit auto-creates on first join has
   * no participant limit at all.
   */
  async ensureRoom(name: string, maxParticipants?: number | null) {
    await this.roomAdmin().createRoom({
      name,
      ...(maxParticipants ? { maxParticipants } : {}),
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
  async receiveWebhook(body: string, authHeader?: string): Promise<WebhookEvent> {
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
