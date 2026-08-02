import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ConnectionState, Track } from 'livekit-client';
import { HlmAlertImports } from '@org/ui-components/alert';
import { HlmAvatarImports } from '@org/ui-components/avatar';
import { HlmBadge } from '@org/ui-components/badge';
import { HlmButton } from '@org/ui-components/button';
import { HlmSeparator } from '@org/ui-components/separator';
import { HlmSpinner } from '@org/ui-components/spinner';
import { RoomService, Tile } from '../../core/room.service';
import { FaNumber } from '../../shared/fa-number.pipe';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';
import { ChatPanel } from './chat-panel';
import { ParticipantTile } from './participant-tile';

interface JoinState {
  identity: string;
  name?: string;
  mic: boolean;
  cam: boolean;
  /** Set by the lobby for private rooms. Never carried in the URL. */
  passcode?: string;
}

type SideTab = 'people' | 'chat';

@Component({
  selector: 'app-room',
  imports: [
    ParticipantTile,
    ChatPanel,
    Logo,
    Icon,
    FaNumber,
    HlmAlertImports,
    HlmAvatarImports,
    HlmBadge,
    HlmButton,
    HlmSeparator,
    HlmSpinner,
  ],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class Room implements OnInit, OnDestroy {
  /** Bound from the `:room` route param. */
  readonly room = input.required<string>();

  private readonly router = inject(Router);
  protected readonly rs = inject(RoomService);

  protected readonly sidebarOpen = signal(window.innerWidth > 900);
  protected readonly tab = signal<SideTab>('people');

  /** Ticks once a second to drive the call timer. */
  private readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

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

  /** Persian caption for the badge; `status()` stays the CSS/state key. */
  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'live':
        return 'زنده';
      case 'connecting':
        return 'در حال اتصال';
      case 'reconnecting':
        return 'اتصال دوباره';
      default:
        return 'آفلاین';
    }
  });

  /** mm:ss (or hh:mm:ss past an hour) in Persian digits. */
  protected readonly elapsed = computed(() => {
    const start = this.rs.sessionStartedAt();
    if (!start) return '';
    const total = Math.max(0, Math.floor((this.now() - start) / 1000));
    const parts =
      total >= 3600
        ? [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
        : [Math.floor(total / 60), total % 60];
    return parts
      .map((n) =>
        new Intl.NumberFormat('fa-IR', {
          minimumIntegerDigits: 2,
          useGrouping: false,
        }).format(n),
      )
      .join(':');
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
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);

    if (this.rs.connected && this.rs.roomName() === this.room()) {
      return; // already in this room (e.g. navigated within app)
    }

    const state = history.state as Partial<JoinState>;
    if (!state?.identity) {
      // Direct link / refresh — send back to the join form with the room filled.
      this.router.navigate(['/join'], { queryParams: { room: this.room() } });
      return;
    }

    try {
      await this.rs.join(this.room(), state.identity, state.name, {
        mic: state.mic ?? true,
        cam: state.cam ?? true,
        passcode: state.passcode,
      });
    } catch (err) {
      // A wrong passcode is a dead end on this screen — there is no field here
      // to correct it in — so bounce back to the form rather than stranding
      // the user in an empty room with an error.
      if (err instanceof HttpErrorResponse && err.status === 403) {
        this.router.navigate(['/join'], {
          queryParams: { room: this.room(), passcode: 'wrong' },
          // Carry the name back so a guest does not retype it to fix a typo
          // in the passcode.
          state: { name: state.name },
        });
        return;
      }
      this.rs.error.set(
        err instanceof Error ? err.message : 'اتصال به اتاق ناموفق بود.',
      );
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    void this.rs.leave();
  }

  async leave(): Promise<void> {
    await this.rs.leave();
    this.router.navigate(['/join']);
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
    if (this.sidebarOpen() && this.tab() === 'chat') this.rs.clearUnread();
  }

  protected openChat(): void {
    this.tab.set('chat');
    this.rs.clearUnread();
  }

  /**
   * Sidebar roster. Reads `revision()` so mute/unmute repaints the indicators —
   * track state lives on the LiveKit objects, not in a signal of its own.
   */
  protected readonly people = computed(() => {
    this.rs.revision();
    return this.rs.tiles().map((tile: Tile) => {
      const p = tile.participant;
      const name = p.name || p.identity;
      const live = (source: Track.Source) => {
        const pub = p.getTrackPublication(source);
        return !!pub && !pub.isMuted;
      };
      return {
        sid: p.sid,
        name,
        initial: name.trim()[0] ?? '؟',
        isLocal: tile.isLocal,
        mic: live(Track.Source.Microphone),
        cam: live(Track.Source.Camera),
      };
    });
  });
}
