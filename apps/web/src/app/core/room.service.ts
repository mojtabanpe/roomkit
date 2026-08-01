import { Injectable, inject, signal } from '@angular/core';
import {
  ConnectionState,
  LocalParticipant,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { MeetingsService } from './meetings.service';
import { TokenService } from './token.service';

export interface Tile {
  participant: Participant;
  isLocal: boolean;
}

export interface ChatMessage {
  id: string;
  from: string;
  identity: string;
  isLocal: boolean;
  text: string;
  at: Date;
}

/** LiveKit's conventional topic for chat text streams. */
const CHAT_TOPIC = 'lk.chat';

/**
 * Wraps a single livekit-client `Room` and projects its state into Angular
 * signals so templates update under zoneless change detection.
 */
@Injectable({ providedIn: 'root' })
export class RoomService {
  private room?: Room;

  /** Bumped whenever track/mute/speaking state changes, to refresh tiles. */
  readonly revision = signal(0);
  readonly connectionState = signal<ConnectionState>(
    ConnectionState.Disconnected,
  );
  readonly tiles = signal<Tile[]>([]);
  readonly roomName = signal<string>('');
  readonly localIdentity = signal<string>('');
  readonly error = signal<string | null>(null);
  /** Non-fatal: joined, but a camera/mic could not be opened. */
  readonly deviceNotice = signal<string | null>(null);

  readonly micEnabled = signal(false);
  readonly camEnabled = signal(false);
  readonly screenShareEnabled = signal(false);

  readonly messages = signal<ChatMessage[]>([]);
  /** Unread count while the chat tab is not the visible one. */
  readonly unreadCount = signal(0);
  /** When the local participant connected. */
  readonly joinedAt = signal<number | null>(null);
  /**
   * When the *meeting* started — the earliest join time among everyone in the
   * room, so the timer reads the same for a latecomer as for the first person
   * in. The value comes from LiveKit's server-stamped `Participant.joinedAt`,
   * not from local clocks, so it is identical on every client.
   */
  readonly sessionStartedAt = signal<number | null>(null);

  private readonly tokens = inject(TokenService);
  private readonly meetings = inject(MeetingsService);

  /** The LiveKit join token — doubles as our proof of room membership. */
  private roomToken: string | null = null;
  private sessionId: string | null = null;

  get connected(): boolean {
    return this.connectionState() === ConnectionState.Connected;
  }

  async join(
    room: string,
    identity: string,
    name: string | undefined,
    opts: { mic: boolean; cam: boolean },
  ): Promise<void> {
    this.error.set(null);
    this.deviceNotice.set(null);
    this.messages.set([]);
    this.unreadCount.set(0);
    const { token, serverUrl } = await this.tokens.fetchToken(room, identity, name);
    this.roomToken = token;

    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.room = lkRoom;
    this.roomName.set(room);
    this.localIdentity.set(identity);
    this.wireEvents(lkRoom);
    this.wireChat(lkRoom);

    await lkRoom.connect(serverUrl, token);
    this.joinedAt.set(Date.now());
    this.syncSessionStart();

    // Losing a device must not cost you the room: someone with no webcam, or
    // who denied the permission prompt, still joins — just muted.
    const denied: string[] = [];
    if (opts.mic) {
      try {
        await lkRoom.localParticipant.setMicrophoneEnabled(true);
      } catch {
        denied.push('میکروفون');
      }
    }
    if (opts.cam) {
      try {
        await lkRoom.localParticipant.setCameraEnabled(true);
      } catch {
        denied.push('دوربین');
      }
    }
    this.deviceNotice.set(
      denied.length
        ? `دسترسی به ${denied.join(' و ')} ممکن نشد. بدون آن وارد جلسه شدید.`
        : null,
    );

    this.syncLocalMediaState();
    this.rebuildTiles();

    // Persistence is a nice-to-have: if the API is down the call still works.
    void this.loadHistory();
    void this.openSession();
  }

  /**
   * Send a chat message to everyone in the room over a LiveKit text stream,
   * and store it so people who join later can still read it.
   *
   * The id is minted here and travels with the stream, so the realtime copy
   * and the stored copy of one message share an id and dedupe cleanly.
   */
  async sendChat(text: string): Promise<void> {
    const body = text.trim();
    const lp = this.room?.localParticipant;
    if (!body || !lp) return;

    const id = crypto.randomUUID();

    await lp.sendText(body, { topic: CHAT_TOPIC, attributes: { id } });
    this.appendMessage({
      id,
      from: lp.name || lp.identity,
      identity: lp.identity,
      isLocal: true,
      text: body,
      at: new Date(),
    });

    if (this.roomToken) {
      try {
        await this.meetings.save(this.roomToken, id, body);
      } catch {
        // Delivered live but not stored — latecomers just won't see it.
      }
    }
  }

  private async loadHistory(): Promise<void> {
    if (!this.roomToken) return;
    try {
      const stored = await this.meetings.history(this.roomToken);
      const localIdentity = this.localIdentity();
      const older = stored.map((m) => ({
        id: m.id,
        from: m.senderName,
        identity: m.senderIdentity,
        isLocal: m.senderIdentity === localIdentity,
        text: m.body,
        at: new Date(m.at),
      }));

      // Anything that already arrived live wins; history fills in the rest.
      this.messages.update((live) => {
        const seen = new Set(live.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...live];
      });
    } catch {
      // No history is survivable; the live chat is unaffected.
    }
  }

  private async openSession(): Promise<void> {
    if (!this.roomToken) return;
    try {
      const { id, startedAt } = await this.meetings.startSession(this.roomToken);
      this.sessionId = id;

      // The API knows about people who were here and already left; LiveKit
      // only knows who is here now. Whichever origin is earlier wins.
      const at = Date.parse(startedAt);
      if (!Number.isNaN(at)) this.adoptSessionStart(at);
    } catch {
      // Attendance tracking is best-effort.
    }
  }

  clearUnread(): void {
    this.unreadCount.set(0);
  }

  private wireChat(room: Room): void {
    room.registerTextStreamHandler(CHAT_TOPIC, async (reader, participant) => {
      // Our own sends echo back through this handler — we already appended
      // them optimistically in `sendChat`, so drop the duplicate.
      if (participant.identity === room.localParticipant.identity) return;

      const text = await reader.readAll();
      if (!text) return;
      this.appendMessage({
        // Sender-minted id when present, so history dedupes against this.
        id: reader.info.attributes?.['id'] || reader.info.id,
        from:
          room.getParticipantByIdentity(participant.identity)?.name ||
          participant.identity,
        identity: participant.identity,
        isLocal: false,
        text,
        at: new Date(reader.info.timestamp || Date.now()),
      });
      this.unreadCount.update((n) => n + 1);
    });
  }

  private appendMessage(message: ChatMessage): void {
    this.messages.update((list) =>
      list.some((m) => m.id === message.id) ? list : [...list, message],
    );
  }

  async toggleMic(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
    this.syncLocalMediaState();
  }

  async toggleCamera(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    await lp.setCameraEnabled(!lp.isCameraEnabled);
    this.syncLocalMediaState();
  }

  async toggleScreenShare(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    await lp.setScreenShareEnabled(!lp.isScreenShareEnabled);
    this.syncLocalMediaState();
  }

  async leave(): Promise<void> {
    if (this.roomToken && this.sessionId) {
      try {
        await this.meetings.endSession(this.roomToken, this.sessionId);
      } catch {
        // Leaving must never be blocked by bookkeeping.
      }
    }

    await this.room?.disconnect();
    this.room = undefined;
    this.roomToken = null;
    this.sessionId = null;
    this.joinedAt.set(null);
    this.sessionStartedAt.set(null);
    this.tiles.set([]);
    this.connectionState.set(ConnectionState.Disconnected);
  }

  private wireEvents(room: Room): void {
    const refresh = () => {
      this.rebuildTiles();
      this.syncSessionStart();
      this.bump();
    };

    room
      .on(RoomEvent.ConnectionStateChanged, (state) =>
        this.connectionState.set(state),
      )
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.TrackSubscribed, refresh)
      .on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.TrackMuted, () => this.bump())
      .on(RoomEvent.TrackUnmuted, () => this.bump())
      .on(RoomEvent.ActiveSpeakersChanged, () => this.bump())
      .on(RoomEvent.Disconnected, () => {
        this.tiles.set([]);
        this.connectionState.set(ConnectionState.Disconnected);
      });
  }

  /** Earliest `joinedAt` among everyone currently in the room. */
  private syncSessionStart(): void {
    if (!this.room) return;
    const times = [
      this.room.localParticipant,
      ...this.room.remoteParticipants.values(),
    ]
      .map((p) => p.joinedAt?.getTime())
      .filter((t): t is number => typeof t === 'number' && t > 0);

    // No server timestamps yet (older server, or info not delivered): fall
    // back to our own connect time rather than showing a blank timer.
    const earliest = times.length ? Math.min(...times) : this.joinedAt();
    if (earliest != null) this.adoptSessionStart(earliest);
  }

  /**
   * The meeting's origin only ever moves earlier. When the person who opened
   * the meeting leaves, the earliest remaining join jumps forward, and letting
   * the timer follow would make a long call look like it just restarted.
   */
  private adoptSessionStart(at: number): void {
    const current = this.sessionStartedAt();
    if (current == null || at < current) this.sessionStartedAt.set(at);
  }

  private rebuildTiles(): void {
    if (!this.room) return;
    const local: Tile = {
      participant: this.room.localParticipant as LocalParticipant,
      isLocal: true,
    };
    const remotes: Tile[] = Array.from(
      this.room.remoteParticipants.values(),
    ).map((p: RemoteParticipant) => ({ participant: p, isLocal: false }));
    this.tiles.set([local, ...remotes]);
  }

  private syncLocalMediaState(): void {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    this.micEnabled.set(lp.isMicrophoneEnabled);
    this.camEnabled.set(lp.isCameraEnabled);
    this.screenShareEnabled.set(lp.isScreenShareEnabled);
    this.bump();
  }

  private bump(): void {
    this.revision.update((v) => v + 1);
  }
}

export { Track };
