import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmAlertImports } from '@org/ui-components/alert';
import { HlmButton } from '@org/ui-components/button';
import { HlmInput } from '@org/ui-components/input';
import { HlmLabel } from '@org/ui-components/label';
import { AuthService } from '../../core/auth.service';
import { Logo } from '../../shared/logo';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-auth-page',
  imports: [
    FormsModule,
    RouterLink,
    Logo,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmAlertImports,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  /** Set from the route data so one component serves both screens. */
  readonly mode = input.required<Mode>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly displayName = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly isRegister = computed(() => this.mode() === 'register');

  protected readonly canSubmit = computed(() => {
    if (this.busy()) return false;
    const base = this.email().trim().length > 0 && this.password().length > 0;
    return this.isRegister()
      ? base && this.displayName().trim().length > 0
      : base;
  });

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      if (this.isRegister()) {
        await this.auth.register(
          this.email().trim(),
          this.displayName().trim(),
          this.password(),
        );
      } else {
        await this.auth.login(this.email().trim(), this.password());
      }
      this.router.navigate(['/join']);
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Surfaces the API's Persian validation messages rather than a generic one. */
  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string | string[] } | null;
      const message = body?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (err.status === 0) return 'ارتباط با سرور برقرار نشد.';
    }
    return 'مشکلی پیش آمد. دوباره تلاش کنید.';
  }
}
