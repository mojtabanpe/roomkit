import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  HlmAlertImports,
  HlmBadge,
  HlmButton,
  HlmCardImports,
  HlmInput,
  HlmLabel,
  HlmSpinner,
  HlmTableImports,
  mainAppUrl,
} from '@org/ui';
import {
  PlanMode,
  TenantApiService,
  TenantMember,
  TenantOverview,
  TenantRoom,
} from '../../core/tenant-api.service';

type Tab = 'overview' | 'members' | 'rooms';

const PLAN_LABELS: Record<PlanMode, string> = {
  unlimited: 'پرو',
  pay_as_you_go: 'مصرفی',
  prepaid: 'رایگان',
};

@Component({
  selector: 'app-tenant-dashboard',
  imports: [
    FormsModule,
    HlmAlertImports,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmSpinner,
    HlmTableImports,
  ],
  templateUrl: './tenant-dashboard.html',
  styleUrl: './tenant-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantDashboard implements OnInit {
  protected readonly api = inject(TenantApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly planLabels = PLAN_LABELS;
  protected readonly appUrl = mainAppUrl();
  protected readonly tab = signal<Tab>('overview');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly overview = signal<TenantOverview | null>(null);
  protected readonly members = signal<TenantMember[]>([]);
  protected readonly rooms = signal<TenantRoom[]>([]);
  protected readonly memberInput = signal('');
  protected readonly roomName = signal('');
  protected readonly roomSlug = signal('');
  protected readonly roomLimit = signal('');
  protected readonly assignSlug = signal('');
  protected readonly assignInput = signal('');
  protected readonly createdRoom = signal<TenantRoom | null>(null);

  protected readonly requests = computed(() =>
    this.members().filter((member) => member.status === 'pending'),
  );
  protected readonly activeMembers = computed(() =>
    this.members().filter((member) => member.status === 'active'),
  );

  async ngOnInit(): Promise<void> {
    this.email.set(this.route.snapshot.queryParamMap.get('email') ?? '');
    await this.api.restore();
    if (this.api.session()) await this.refresh();
  }

  protected async signIn(): Promise<void> {
    await this.run(async () => {
      await this.api.login(this.email().trim(), this.password());
      this.password.set('');
      await this.refresh();
    });
  }

  protected signOut(): void {
    this.api.logout();
    this.overview.set(null);
    this.members.set([]);
    this.rooms.set([]);
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
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

  protected async refresh(): Promise<void> {
    const [overview, members, rooms] = await Promise.all([
      this.api.overview(),
      this.api.members(),
      this.api.rooms(),
    ]);
    this.overview.set(overview);
    this.members.set(members);
    this.rooms.set(rooms);
    if (!this.assignSlug() && rooms[0]) this.assignSlug.set(rooms[0].slug);
  }

  protected async importFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.memberInput.set(await file.text());
  }

  protected async addMembers(): Promise<void> {
    const usernames = this.parseUsernames(this.memberInput());
    if (!usernames.length) return;
    await this.run(async () => {
      const result = await this.api.addMembers(usernames);
      this.memberInput.set('');
      this.notice.set(
        `${result.added.length.toLocaleString('fa-IR')} کاربر اضافه شد` +
          (result.notFound.length
            ? `؛ ${result.notFound.length.toLocaleString('fa-IR')} نام کاربری پیدا نشد.`
            : '.'),
      );
      await this.refresh();
    });
  }

  protected async decide(
    member: TenantMember,
    decision: 'approve' | 'reject',
  ): Promise<void> {
    await this.run(async () => {
      await this.api.decide(member.id, decision);
      await this.refresh();
    });
  }

  protected normalizeSlug(value: string): void {
    this.roomSlug.set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 64),
    );
  }

  protected async createRoom(): Promise<void> {
    if (!this.roomName().trim() || !this.roomSlug()) return;
    await this.run(async () => {
      const maxParticipants = Number(this.roomLimit());
      const planLimit = this.overview()?.roomLimits.maxParticipants ?? null;
      const room = await this.api.createRoom({
        name: this.roomName().trim(),
        slug: this.roomSlug(),
        ...(maxParticipants >= 2
          ? {
              maxParticipants:
                planLimit === null
                  ? maxParticipants
                  : Math.min(maxParticipants, planLimit),
            }
          : {}),
      });
      this.createdRoom.set(room);
      this.roomName.set('');
      this.roomSlug.set('');
      this.roomLimit.set('');
      this.notice.set('روم ساخته شد؛ کلید را همین حالا کپی کنید.');
      await this.refresh();
    });
  }

  protected async assignUsers(): Promise<void> {
    const usernames = this.parseUsernames(this.assignInput());
    if (!this.assignSlug() || !usernames.length) return;
    await this.run(async () => {
      const result = await this.api.assignRoomUsers(
        this.assignSlug(),
        usernames,
      );
      this.assignInput.set('');
      this.notice.set(
        `${result.assigned.length.toLocaleString('fa-IR')} کاربر به روم متصل شد.`,
      );
      await this.refresh();
    });
  }

  protected publicUrl(path: string): string {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:5200${path}`;
    }
    return `${protocol}//${hostname.replace(/^tenant\./, '')}${path}`;
  }

  protected minutes(value: number): string {
    return Math.max(0, Math.floor(value / 60)).toLocaleString('fa-IR');
  }

  private parseUsernames(value: string): string[] {
    return [
      ...new Set(
        value
          .split(/[\s,;]+/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await work();
    } catch (error) {
      this.error.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { message?: string | string[] })?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
    }
    return 'انجام عملیات ممکن نشد. دوباره تلاش کنید.';
  }
}
