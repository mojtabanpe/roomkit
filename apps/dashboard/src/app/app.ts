import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HlmAlertImports,
  HlmBadge,
  HlmButton,
  HlmCardImports,
  HlmInput,
  HlmLabel,
  HlmSpinner,
  mainAppUrl,
} from '@org/ui';
import { firstValueFrom } from 'rxjs';

type PlanMode = 'unlimited' | 'pay_as_you_go' | 'prepaid';
type AdminSection = 'overview' | 'subscriptions';

interface Subscription {
  id: string;
  name: string;
  key: string;
  planMode: PlanMode;
  active: boolean;
  usedUnits: number;
  remainingUnits: number | null;
}

const TOKEN_KEY = 'roomkit.dashboard.admin-token';
const PLAN_LABELS: Record<PlanMode, string> = {
  unlimited: 'پرو',
  pay_as_you_go: 'مصرفی',
  prepaid: 'رایگان',
};
const NUMBER_FORMAT = new Intl.NumberFormat('fa-IR');

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmSpinner,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly planLabels = PLAN_LABELS;
  protected readonly appUrl = mainAppUrl();
  protected readonly token = signal(sessionStorage.getItem(TOKEN_KEY));
  protected readonly tokenInput = signal('');
  protected readonly section = signal<AdminSection>('overview');
  protected readonly subscriptions = signal<Subscription[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeCount = computed(
    () => this.subscriptions().filter((item) => item.active).length,
  );
  protected readonly suspendedCount = computed(
    () => this.subscriptions().filter((item) => !item.active).length,
  );

  ngOnInit(): void {
    if (this.token()) void this.load();
  }

  protected async signIn(): Promise<void> {
    const token = this.tokenInput().trim();
    if (!token) return;
    sessionStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
    this.tokenInput.set('');
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const headers = new HttpHeaders({
        'X-Admin-Token': this.token() ?? '',
      });
      this.subscriptions.set(
        await firstValueFrom(
          this.http.get<Subscription[]>('/api/admin/tenants', { headers }),
        ),
      );
    } catch {
      this.error.set('دسترسی ادمین معتبر نیست یا بارگذاری انجام نشد.');
    } finally {
      this.loading.set(false);
    }
  }

  protected signOut(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.subscriptions.set([]);
    this.section.set('overview');
  }

  protected selectSection(section: AdminSection): void {
    this.section.set(section);
    requestAnimationFrame(() => {
      document.getElementById('dashboard-content')?.focus({
        preventScroll: true,
      });
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    });
  }

  protected minutes(value: number): string {
    return NUMBER_FORMAT.format(Math.max(0, Math.floor(value / 60)));
  }
}
