import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
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
} from '@org/ui';
import { AuthService } from '../../core/auth.service';
import {
  TenantMembershipService,
  UserTenantMembership,
} from '../../core/tenant-membership.service';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-profile',
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
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly memberships = inject(TenantMembershipService);
  private readonly router = inject(Router);
  protected readonly displayName = signal('');
  protected readonly username = signal('');
  protected readonly tenantKey = signal('');
  protected readonly membership = signal<UserTenantMembership | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      await this.router.navigate(['/login']);
      return;
    }
    const user = this.auth.user();
    if (!user) return;
    this.displayName.set(user.displayName);
    this.username.set(user.username);
    this.membership.set(await this.memberships.current());
  }

  protected async save(): Promise<void> {
    await this.run(async () => {
      await this.auth.updateProfile(
        this.displayName().trim(),
        this.username().trim().toLowerCase(),
      );
      this.message.set('پروفایل ذخیره شد.');
    });
  }

  protected async requestMembership(): Promise<void> {
    if (!this.tenantKey().trim()) return;
    await this.run(async () => {
      this.membership.set(
        await this.memberships.request(this.tenantKey().trim().toLowerCase()),
      );
      this.message.set('درخواست برای tenant ارسال شد.');
    });
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    try {
      await work();
    } catch (error) {
      this.error.set(this.errorFor(error));
    } finally {
      this.busy.set(false);
    }
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const value = (error.error as { message?: string | string[] })?.message;
      return Array.isArray(value)
        ? value.join(' ')
        : (value ?? 'عملیات انجام نشد.');
    }
    return 'عملیات انجام نشد.';
  }
}
