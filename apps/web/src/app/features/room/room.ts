import { Component, OnDestroy, OnInit, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectionState } from 'livekit-client';
import { RoomService } from '../../core/room.service';
import { ParticipantTile } from './participant-tile';

interface JoinState {
  identity: string;
  name?: string;
  mic: boolean;
  cam: boolean;
}

@Component({
  selector: 'app-room',
  imports: [ParticipantTile],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class Room implements OnInit, OnDestroy {
  /** Bound from the `:room` route param. */
  readonly room = input.required<string>();

  private readonly router = inject(Router);
  protected readonly rs = inject(RoomService);

  protected readonly status = computed(() => {
    switch (this.rs.connectionState()) {
      case ConnectionState.Connected:
        return 'live';
      case ConnectionState.Connecting:
        return 'connecting';
      case ConnectionState.Reconnecting:
        return 'reconnecting';
      default:
        return 'offline';
    }
  });

  // Re-reads on revision changes so the grid sizes itself to participant count.
  protected readonly columns = computed(() => {
    this.rs.revision();
    const n = this.rs.tiles().length;
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
  });

  async ngOnInit(): Promise<void> {
    if (this.rs.connected && this.rs.roomName() === this.room()) {
      return; // already in this room (e.g. navigated within app)
    }

    const state = history.state as Partial<JoinState>;
    if (!state?.identity) {
      // Direct link / refresh — send back to the lobby with the room prefilled.
      this.router.navigate(['/'], { queryParams: { room: this.room() } });
      return;
    }

    try {
      await this.rs.join(this.room(), state.identity, state.name, {
        mic: state.mic ?? true,
        cam: state.cam ?? true,
      });
    } catch (err) {
      this.rs.error.set(
        err instanceof Error ? err.message : 'Failed to connect to the room.',
      );
    }
  }

  ngOnDestroy(): void {
    void this.rs.leave();
  }

  async leave(): Promise<void> {
    await this.rs.leave();
    this.router.navigate(['/']);
  }
}
