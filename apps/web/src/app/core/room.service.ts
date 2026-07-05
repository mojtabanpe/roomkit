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
import { TokenService } from './token.service';

export interface Tile {
  participant: Participant;
  isLocal: boolean;
}

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

  readonly micEnabled = signal(false);
  readonly camEnabled = signal(false);
  readonly screenShareEnabled = signal(false);

  private readonly tokens = inject(TokenService);

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
    const { token, serverUrl } = await this.tokens.fetchToken(room, identity, name);

    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.room = lkRoom;
    this.roomName.set(room);
    this.localIdentity.set(identity);
    this.wireEvents(lkRoom);

    await lkRoom.connect(serverUrl, token);

    await lkRoom.localParticipant.setMicrophoneEnabled(opts.mic);
    await lkRoom.localParticipant.setCameraEnabled(opts.cam);

    this.syncLocalMediaState();
    this.rebuildTiles();
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
    await this.room?.disconnect();
    this.room = undefined;
    this.tiles.set([]);
    this.connectionState.set(ConnectionState.Disconnected);
  }

  private wireEvents(room: Room): void {
    const refresh = () => {
      this.rebuildTiles();
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
