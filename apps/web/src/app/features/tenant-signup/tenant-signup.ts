import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  HlmAlertImports,
  HlmButton,
  HlmCardImports,
  HlmInput,
  HlmLabel,
  HlmSpinner,
} from '@org/ui';
import {
  PublicPlanCode,
  TenantOnboardingService,
  TenantWorkspaceResult,
} from '../../core/tenant-onboarding.service';
import { tenantPortalUrl } from '../../core/tenant-portal-url';
import { Logo } from '../../shared/logo';

const PLANS: Record<
  PublicPlanCode,
  { label: string; price: string; note: string }
> = {
  free: {
    label: 'رایگان',
    price: '۰ تومان',
    note: 'تا ۱۰ نفر هم‌زمان · جلسهٔ ۳۰ دقیقه‌ای',
  },
  pro: {
    label: 'پرو',
    price: '۷٬۰۰۰٬۰۰۰ تومان ماهانه',
    note: 'تا ۳۰۰ نفر هم‌زمان · جلسه نامحدود',
  },
  usage: {
    label: 'مصرفی',
    price: 'بر پایهٔ مصرف',
    note: 'پرداخت متناسب با دقیقهٔ حضور',
  },
};

@Component({
  selector: 'app-tenant-signup',
  imports: [
    FormsModule,
    RouterLink,
    Logo,
    HlmAlertImports,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmSpinner,
  ],
  templateUrl: './tenant-signup.html',
  styleUrl: './tenant-signup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantSignup {
  private readonly onboarding = inject(TenantOnboardingService);
  private readonly route = inject(ActivatedRoute);

  protected readonly plan = signal<PublicPlanCode>(this.readPlan());
  protected readonly tenantName = signal('');
  protected readonly tenantKey = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<TenantWorkspaceResult | null>(null);

  protected readonly selectedPlan = computed(() => PLANS[this.plan()]);
  protected readonly portalUrl = computed(() =>
    tenantPortalUrl(this.email().trim()),
  );
  protected readonly canSubmit = computed(() => {
    if (this.busy()) return false;
    const workspaceReady =
      this.tenantName().trim().length >= 2 &&
      /^[a-z0-9-]{2,12}$/.test(this.tenantKey());
    if (!workspaceReady) return false;
    return this.email().trim().length > 0 && this.password().length >= 8;
  });

  protected normalizeKey(value: string): void {
    this.tenantKey.set(
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 12),
    );
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);

    const workspace = {
      tenantName: this.tenantName().trim(),
      tenantKey: this.tenantKey(),
      plan: this.plan(),
    };

    try {
      const result = await this.onboarding.register({
        ...workspace,
        email: this.email().trim(),
        password: this.password(),
      });
      this.password.set('');
      this.result.set(result);
    } catch (error) {
      this.error.set(this.messageFor(error));
    } finally {
      this.busy.set(false);
    }
  }

  private readPlan(): PublicPlanCode {
    const plan = this.route.snapshot.queryParamMap.get('plan');
    return plan === 'pro' || plan === 'usage' ? plan : 'free';
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const message = body?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'ارتباط با سرور برقرار نشد.';
    }
    return 'ثبت فروشگاه انجام نشد. دوباره تلاش کنید.';
  }
}
