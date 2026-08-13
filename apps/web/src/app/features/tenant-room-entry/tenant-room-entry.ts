import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  HlmAlertImports,
  HlmBadge,
  HlmButton,
  HlmCardImports,
  HlmInput,
  HlmLabel,
  HlmSpinner,
} from '@org/ui';
import { AuthService } from '../../core/auth.service';
import {
  PublicTenantRoom,
  TenantRoomService,
} from '../../core/tenant-room.service';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-tenant-room-entry',
  imports: [
    FormsModule,
    RouterLink,
    Logo,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmSpinner,
  ],
  templateUrl: './tenant-room-entry.html',
  styleUrl: './tenant-room-entry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantRoomEntry implements OnInit {
  readonly tenantKey = input.required<string>();
  readonly room = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly rooms = inject(TenantRoomService);
  private readonly router = inject(Router);
  protected readonly data = signal<PublicTenantRoom | null>(null);
  protected readonly displayName = signal('');
  protected readonly key = signal('');
  protected readonly mic = signal(true);
  protected readonly cam = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.data.set(await this.rooms.view(this.tenantKey(), this.room()));
      const user = this.auth.user();
      if (user) this.displayName.set(user.displayName);
    } catch {
      this.error.set('روم موردنظر پیدا نشد.');
    }
  }

  protected async enter(): Promise<void> {
    if (!this.auth.isLoggedIn() && !this.displayName().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const tokenResponse = await this.rooms.token(
        this.tenantKey(),
        this.room(),
        {
          ...(this.key().trim() ? { key: this.key().trim() } : {}),
          ...(!this.auth.isLoggedIn()
            ? { displayName: this.displayName().trim() }
            : {}),
        },
      );
      await this.router.navigate(
        ['/t', this.tenantKey(), this.room(), 'call'],
        {
          state: {
            identity: tokenResponse.identity,
            name: this.auth.user()?.displayName ?? this.displayName().trim(),
            mic: this.mic(),
            cam: this.cam(),
            tokenResponse,
          },
        },
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const value = (error.error as { message?: string })?.message;
        this.error.set(value ?? 'ورود به روم انجام نشد.');
      } else this.error.set('ورود به روم انجام نشد.');
    } finally {
      this.busy.set(false);
    }
  }
}
