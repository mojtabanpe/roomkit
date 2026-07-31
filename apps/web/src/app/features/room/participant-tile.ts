import {
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Track } from 'livekit-client';
import { Tile } from '../../core/room.service';
import { Icon } from '../../shared/icon';

/**
 * Renders one participant: their camera/screen video, name, and live status.
 * Re-attaches media whenever `revision` changes (driven by RoomService events).
 */
@Component({
  selector: 'app-participant-tile',
  imports: [Icon],
  template: `
    <div class="tile" [class.speaking]="isSpeaking()" [class.no-video]="!hasVideo()">
      <video #video class="video" autoplay playsinline [muted]="tile().isLocal"></video>
      <audio #audio autoplay></audio>

      @if (!hasVideo()) {
        <div class="avatar">
          <span>{{ initials() }}</span>
        </div>
      }

      <div class="overlay">
        <div class="name">
          <span class="dot" [class.live]="isSpeaking()"></span>
          {{ label() }}
          @if (tile().isLocal) { <em>شما</em> }
        </div>
        <div class="badges">
          @if (!micOn()) {
            <span class="badge muted" title="صدا قطع است">
              <app-icon name="mic-off" [strokeWidth]="2" />
            </span>
          }
          @if (isScreen()) {
            <span class="badge screen">
              <app-icon name="screen-share" [strokeWidth]="2" /> صفحه
            </span>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './participant-tile.scss',
})
export class ParticipantTile {
  readonly tile = input.required<Tile>();
  /** Change-detection trigger from RoomService. */
  readonly revision = input(0);

  private readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly audioRef =
    viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  constructor() {
    effect(() => {
      // Depend on revision so attachment re-runs when tracks change.
      this.revision();
      this.tile();
      this.syncMedia();
    });
  }

  private get participant() {
    return this.tile().participant;
  }

  private videoPub() {
    const p = this.participant;
    return (
      p.getTrackPublication(Track.Source.ScreenShare) ??
      p.getTrackPublication(Track.Source.Camera)
    );
  }

  isScreen(): boolean {
    return !!this.participant.getTrackPublication(Track.Source.ScreenShare)
      ?.videoTrack;
  }

  hasVideo(): boolean {
    const pub = this.videoPub();
    return !!pub?.videoTrack && !pub.isMuted;
  }

  micOn(): boolean {
    const pub = this.participant.getTrackPublication(Track.Source.Microphone);
    return !!pub && !pub.isMuted;
  }

  isSpeaking(): boolean {
    return this.participant.isSpeaking;
  }

  label(): string {
    return this.participant.name || this.participant.identity;
  }

  initials(): string {
    const s = this.label().trim();
    // Persian script is cursive — two loose letters would join into a
    // nonsense ligature, so show a single letter for Persian names.
    if (/[؀-ۿ]/.test(s)) {
      return s[0] ?? '';
    }
    const parts = s.split(/\s+/).filter(Boolean);
    const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2);
    return chars.toUpperCase();
  }

  private syncMedia(): void {
    const videoEl = this.videoRef().nativeElement;
    const videoTrack = this.videoPub()?.videoTrack;
    if (videoTrack && !this.videoPub()?.isMuted) {
      videoTrack.attach(videoEl);
    } else {
      videoEl.srcObject = null;
    }

    // Only attach remote audio — local playback would echo.
    const audioEl = this.audioRef().nativeElement;
    if (!this.tile().isLocal) {
      const audioTrack = this.participant.getTrackPublication(
        Track.Source.Microphone,
      )?.audioTrack;
      if (audioTrack) {
        audioTrack.attach(audioEl);
      } else {
        audioEl.srcObject = null;
      }
    }
  }
}
