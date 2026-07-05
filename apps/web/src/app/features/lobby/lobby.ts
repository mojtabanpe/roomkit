import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-lobby',
  imports: [FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss',
})
export class Lobby {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected name = signal('');
  protected room = signal(
    this.route.snapshot.queryParamMap.get('room') ?? '',
  );
  protected mic = signal(true);
  protected cam = signal(true);

  protected suggestRoom(): void {
    const words = ['signal', 'studio', 'channel', 'relay', 'beacon', 'array'];
    const w = words[Math.floor(Math.random() * words.length)];
    this.room.set(`${w}-${Math.floor(1000 + Math.random() * 8999)}`);
  }

  protected canJoin(): boolean {
    return this.name().trim().length > 0 && this.slug(this.room()).length > 0;
  }

  protected join(): void {
    if (!this.canJoin()) return;
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
      },
    });
  }

  private slug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
