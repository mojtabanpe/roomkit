import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButton } from '@org/ui-components/button';
import { HlmInput } from '@org/ui-components/input';
import { HlmLabel } from '@org/ui-components/label';
import { AuthService } from '../../core/auth.service';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';

interface SavedRoom {
  slug: string;
  name: string;
}

interface RoomLookup {
  slug: string;
  name: string;
  visibility: 'public' | 'private';
}

@Component({
  selector: 'app-lobby',
  imports: [FormsModule, RouterLink, Logo, Icon, HlmButton, HlmInput, HlmLabel],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss',
})
export class Lobby {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);

  /**
   * Signed-in users get their account name; guests type one. A name handed
   * back in navigation state wins — that is the room screen returning us here
   * after a rejected passcode.
   */
  protected name = signal(
    (history.state as { name?: string } | undefined)?.name ??
      this.auth.user()?.displayName ??
      '',
  );
  protected room = signal(
    this.route.snapshot.queryParamMap.get('room') ?? '',
  );
  protected mic = signal(true);
  protected cam = signal(true);

  protected readonly savedRooms = signal<SavedRoom[]>([]);

  protected passcode = signal('');
  /** Null until we have looked the room up; drives the passcode field. */
  protected readonly lookup = signal<RoomLookup | null>(null);
  protected readonly checking = signal(false);

  /** Set when the room screen bounced us back for a rejected passcode. */
  protected readonly passcodeRejected = signal(
    this.route.snapshot.queryParamMap.get('passcode') === 'wrong',
  );

  constructor() {
    if (this.auth.isLoggedIn()) void this.loadSavedRooms();
    // A room may already be filled in from ?room= on a bounced direct link.
    if (this.room().trim()) void this.checkRoom();
  }

  private async loadSavedRooms(): Promise<void> {
    try {
      this.savedRooms.set(
        await firstValueFrom(this.http.get<SavedRoom[]>('/api/rooms/mine')),
      );
    } catch {
      // A missing room list is not worth blocking the join form over.
    }
  }

  protected useRoom(slug: string): void {
    this.room.set(slug);
    void this.checkRoom();
  }

  /**
   * Looks the room up so a private one can ask for its passcode *before* the
   * user leaves this page. Without it the join succeeds as far as the router
   * and then dies with a 403 inside the room screen, where there is nowhere to
   * type the passcode.
   *
   * A 404 is the normal case, not an error: most rooms are ad-hoc and have no
   * record at all.
   */
  protected async checkRoom(): Promise<void> {
    const slug = this.slug(this.room());
    if (!slug) {
      this.lookup.set(null);
      return;
    }
    if (this.lookup()?.slug === slug) return;

    this.checking.set(true);
    try {
      this.lookup.set(
        await firstValueFrom(
          this.http.get<RoomLookup>(`/api/rooms/${encodeURIComponent(slug)}`),
        ),
      );
    } catch {
      this.lookup.set(null);
    } finally {
      this.checking.set(false);
    }
  }

  protected isPrivate(): boolean {
    return this.lookup()?.visibility === 'private';
  }

  protected suggestRoom(): void {
    const words = ['signal', 'studio', 'channel', 'relay', 'beacon', 'array'];
    const w = words[Math.floor(Math.random() * words.length)];
    this.room.set(`${w}-${Math.floor(1000 + Math.random() * 8999)}`);
  }

  protected canJoin(): boolean {
    if (this.checking()) return false;
    if (this.isPrivate() && !this.passcode().trim()) return false;
    return this.name().trim().length > 0 && this.slug(this.room()).length > 0;
  }

  protected join(): void {
    if (!this.canJoin()) return;
    this.passcodeRejected.set(false);
    const room = this.slug(this.room());
    const display = this.name().trim();
    const identity = `${this.slug(display) || 'guest'}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    this.router.navigate(['/room', room], {
      state: {
        identity,
        name: display,
        mic: this.mic(),
        cam: this.cam(),
        // Travels in navigation state, never in the URL — a passcode in a
        // query string ends up in history and in every referrer header.
        passcode: this.isPrivate() ? this.passcode().trim() : undefined,
      },
    });
  }

  /**
   * Room/identity slug. Persian letters are kept as-is (users name rooms in
   * Persian), Persian/Arabic digits are folded to ASCII, and everything else
   * collapses to a dash.
   */
  private slug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/‌/g, '') // ZWNJ joins one word — drop it, don't dash it
      .replace(/[^a-z0-9؀-ۿ]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
