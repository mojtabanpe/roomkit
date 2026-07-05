import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

export interface JoinTokenRequest {
  /** Room the participant will join. Created on demand by LiveKit. */
  room: string;
  /** Stable, unique identity for the participant. */
  identity: string;
  /** Optional human-readable display name. */
  name?: string;
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
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const serverUrl = this.config.get<string>('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new InternalServerErrorException(
        'LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL.',
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.identity,
      name: req.name,
      // Tokens are only validated on the initial connection.
      ttl: '1h',
    });

    const grant: VideoGrant = {
      room: req.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    };
    at.addGrant(grant);

    const token = await at.toJwt();

    return { token, serverUrl, room: req.room, identity: req.identity };
  }
}
