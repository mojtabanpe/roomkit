import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmAlertImports } from '@org/ui-components/alert';
import { HlmBadge } from '@org/ui-components/badge';
import { HlmButton } from '@org/ui-components/button';
import { HlmInput } from '@org/ui-components/input';
import { HlmLabel } from '@org/ui-components/label';
import {
  AdminService,
  IssuedKey,
  PlanMode,
  TenantDetail,
  TenantSummary,
} from '../../core/admin.service';
import { FaNumber } from '../../shared/fa-number.pipe';
import { Logo } from '../../shared/logo';

/** Balances are stored in billable seconds; operators think in minutes. */
const SECONDS_PER_MINUTE = 60;

export const PLAN_LABELS: Record<PlanMode, string> = {
  unlimited: 'نامحدود',
  pay_as_you_go: 'مصرفی',
  prepaid: 'اعتبار پیش‌پرداخت',
};

@Component({
  selector: 'app-admin-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    Logo,
    FaNumber,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmBadge,
    HlmAlertImports,
  ],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPage {
  private readonly admin = inject(AdminService);

  protected readonly planLabels = PLAN_LABELS;
  protected readonly planModes: PlanMode[] = [
    'prepaid',
    'pay_as_you_go',
    'unlimited',
  ];

  protected readonly hasToken = computed(() => this.admin.token() !== null);
  protected readonly tokenInput = signal('');

  protected readonly tenants = signal<TenantSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Which platform's drawer is open, and its freshly loaded detail. */
  protected readonly openId = signal<string | null>(null);
  protected readonly detail = signal<TenantDetail | null>(null);

  /**
   * A key the operator has just minted. It is held here only so it can be
   * copied — the server keeps a hash, so once this is cleared it is gone.
   */
  protected readonly newKey = signal<IssuedKey | null>(null);

  protected readonly creating = signal(false);
  protected readonly form = signal({
    key: '',
    name: '',
    planMode: 'prepaid' as PlanMode,
  });

  protected readonly topUpMinutes = signal('');
  protected readonly creditMinutes = signal('');

  constructor() {
    if (this.hasToken()) void this.refresh();
  }

  protected async signIn(): Promise<void> {
    const token = this.tokenInput().trim();
    if (!token) return;
    this.admin.setToken(token);
    this.tokenInput.set('');
    await this.refresh();
  }

  protected signOut(): void {
    this.admin.clearToken();
    this.tenants.set([]);
    this.openId.set(null);
    this.detail.set(null);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.tenants.set(await this.admin.list());
    } catch (err) {
      // A rejected token is the common case — drop it so the gate comes back.
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.admin.clearToken();
      }
      this.error.set(this.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async toggle(tenant: TenantSummary): Promise<void> {
    if (this.openId() === tenant.id) {
      this.openId.set(null);
      this.detail.set(null);
      return;
    }
    this.openId.set(tenant.id);
    this.detail.set(null);
    this.newKey.set(null);
    this.topUpMinutes.set('');
    this.creditMinutes.set('');
    await this.loadDetail(tenant.id);
  }

  protected async createTenant(): Promise<void> {
    const { key, name, planMode } = this.form();
    if (!key.trim() || !name.trim()) return;

    this.creating.set(true);
    this.error.set(null);
    try {
      await this.admin.create({
        key: key.trim(),
        name: name.trim(),
        planMode,
      });
      this.form.set({ key: '', name: '', planMode: 'prepaid' });
      await this.refresh();
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.creating.set(false);
    }
  }

  protected async setPlan(tenant: TenantSummary, mode: PlanMode): Promise<void> {
    await this.run(() => this.admin.update(tenant.id, { planMode: mode }));
  }

  protected async setActive(
    tenant: TenantSummary,
    active: boolean,
  ): Promise<void> {
    await this.run(() => this.admin.update(tenant.id, { active }));
  }

  protected async topUp(tenant: TenantSummary): Promise<void> {
    const minutes = Number(this.topUpMinutes());
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    await this.run(() =>
      this.admin.topUp(tenant.id, Math.round(minutes * SECONDS_PER_MINUTE)),
    );
    this.topUpMinutes.set('');
  }

  protected async setCredit(tenant: TenantSummary): Promise<void> {
    const minutes = Number(this.creditMinutes());
    if (!Number.isFinite(minutes) || minutes < 0) return;
    await this.run(() =>
      this.admin.setCreditLimit(
        tenant.id,
        Math.round(minutes * SECONDS_PER_MINUTE),
      ),
    );
    this.creditMinutes.set('');
  }

  protected async issueKey(tenant: TenantSummary): Promise<void> {
    this.error.set(null);
    try {
      this.newKey.set(await this.admin.issueKey(tenant.id, 'default'));
      await this.loadDetail(tenant.id);
    } catch (err) {
      this.error.set(this.messageFor(err));
    }
  }

  protected async revokeKey(
    tenant: TenantSummary,
    keyId: string,
  ): Promise<void> {
    await this.run(() => this.admin.revokeKey(tenant.id, keyId));
  }

  protected async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is blocked outside a secure context; the key is on screen.
    }
  }

  protected minutes(units: number | null): number | null {
    return units === null ? null : Math.round(units / SECONDS_PER_MINUTE);
  }

  /** Runs a mutation, then reloads both the list and the open drawer. */
  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      await this.refresh();
      const id = this.openId();
      if (id) await this.loadDetail(id);
    } catch (err) {
      this.error.set(this.messageFor(err));
    }
  }

  private async loadDetail(id: string): Promise<void> {
    try {
      this.detail.set(await this.admin.get(id));
    } catch (err) {
      this.error.set(this.messageFor(err));
    }
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) return 'توکن مدیریت پذیرفته نشد.';
      const body = err.error as { message?: string | string[] } | null;
      const message = body?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (err.status === 0) return 'ارتباط با سرور برقرار نشد.';
    }
    return 'مشکلی پیش آمد. دوباره تلاش کنید.';
  }
}
