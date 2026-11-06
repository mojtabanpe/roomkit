import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
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
  /**
   * Moderator powers inside the room: mute someone else, remove them, change
   * their permissions. A classroom needs exactly one of these (the teacher), so
   * the calling platform decides — we only encode what it asks for.
   */
  roomAdmin?: boolean;
  /** Product limits the client must apply when publishing media. */
  limits?: RoomConnectionLimits;
}

/** One participant as LiveKit currently sees them. */
export interface ParticipantView {
  identity: string;
  name: string;
  joinedAt: Date | null;
  publishing: boolean;
  tracks: { sid: string; source: string; muted: boolean }[];
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

const MIN_TOKEN_TTL_SECONDS = 60 * 60;
const MAX_TOKEN_TTL_SECONDS = 12 * 60 * 60;

/**
 * Long enough to cover the whole call plus a grace margin for a late reconnect,
 * without minting credentials that stay valid all day. An uncapped plan gets
 * the ceiling — we have no session length to size it against.
 */
function tokenTtlSeconds(maxDurationSeconds: number | null): number {
  if (maxDurationSeconds === null) return MAX_TOKEN_TTL_SECONDS;
  const withGrace = maxDurationSeconds + 30 * 60;
  return Math.min(
    MAX_TOKEN_TTL_SECONDS,
    Math.max(MIN_TOKEN_TTL_SECONDS, withGrace),
  );
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
      // Validated on the initial connection *and* on every reconnect, so a
      // token must outlive the call it is for — an hour is not enough for a
      // 90-minute class that drops its connection at minute 70.
      ttl: tokenTtlSeconds(req.limits?.maxDurationSeconds ?? null),
    });

    const grant: VideoGrant = {
      room: req.room,
      roomJoin: true,
      canPublish: req.canPublish ?? true,
      canSubscribe: true,
      canPublishData: true,
      ...(req.roomAdmin ? { roomAdmin: true } : {}),
    };
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

  async listParticipants(room: string): Promise<ParticipantView[]> {
    const people = await this.roomAdmin().listParticipants(room);
    return people.map((person) => ({
      identity: person.identity,
      name: person.name,
      joinedAt: person.joinedAt ? new Date(Number(person.joinedAt) * 1000) : null,
      publishing: person.tracks.some((track) => !track.muted),
      tracks: person.tracks.map((track) => ({
        sid: track.sid,
        source: String(track.source),
        muted: track.muted,
      })),
    }));
  }

  /**
   * Mute everything one participant is publishing. LiveKit only mutes a single
   * track at a time, and a person can be sending mic, camera and a screen at
   * once — the caller means "silence them", not "silence one track".
   */
  async muteParticipant(room: string, identity: string): Promise<number> {
    const admin = this.roomAdmin();
    const [person] = (await admin.listParticipants(room)).filter(
      (candidate) => candidate.identity === identity,
    );
    if (!person) return 0;
    const live = person.tracks.filter((track) => !track.muted);
    for (const track of live) {
      await admin.mutePublishedTrack(room, identity, track.sid, true);
    }
    return live.length;
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    await this.roomAdmin().removeParticipant(room, identity);
  }

  /** Ends a call for everyone in it — how a spent tenant gets cut off. */
  async closeRoom(name: string): Promise<void> {
    await this.roomAdmin().deleteRoom(name);
  }

  /**
   * Start a room-composite recording — one mp4 of the call as a viewer would
   * see it, rather than one file per track.
   *
   * `filepath` is a path *inside the egress container*, which shares
   * `RECORDINGS_DIR` with the API container through a docker volume. The two
   * must agree on that mount or the API will serve 404s for files that exist.
   */
  async startRoomRecording(
    room: string,
    relativePath: string,
  ): Promise<{ egressId: string }> {
    const info = await this.egress().startRoomCompositeEgress(
      room,
      new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `${this.recordingsDir()}/${relativePath}`,
      }),
      {
        layout: 'speaker',
        // 720p keeps a 90-minute class near ~1GB and keeps the headless
        // browser's CPU cost survivable on a shared box.
        encodingOptions: EncodingOptionsPreset.H264_720P_30,
      },
    );
    return { egressId: info.egressId };
  }

  async stopRecording(egressId: string): Promise<void> {
    await this.egress().stopEgress(egressId);
  }

  /** Where finished files land, as both containers see it. */
  recordingsDir(): string {
    return this.config.get<string>('RECORDINGS_DIR') ?? '/recordings';
  }

  private egress(): EgressClient {
    const { apiKey, apiSecret, serverUrl } = this.credentials();
    return new EgressClient(
      serverUrl.replace(/^ws/, 'http'),
      apiKey,
      apiSecret,
    );
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
