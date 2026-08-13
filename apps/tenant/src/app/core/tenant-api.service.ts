import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type PlanMode = 'unlimited' | 'pay_as_you_go' | 'prepaid';
export type MemberStatus = 'pending' | 'active' | 'rejected';

export interface TenantSession {
  id: string;
  email: string;
  key: string;
  name: string;
}

export interface TenantOverview {
  tenant: { name: string; key: string; active: boolean };
  subscription: {
    planMode: PlanMode;
    includedUnits: number;
    usedUnits: number;
    creditLimitUnits: number;
    remainingUnits: number | null;
  };
  roomLimits: RoomConnectionLimits;
}

export interface RoomConnectionLimits {
  maxParticipants: number | null;
  maxDurationSeconds: number | null;
  video: {
    width: number;
    height: number;
    frameRate: number;
    maxBitrate: number;
  } | null;
}

export interface TenantMember {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: MemberStatus;
  source: 'tenant' | 'user';
  createdAt: string;
}

export interface TenantRoom {
  slug: string;
  name: string;
  url: string;
  maxParticipants: number | null;
  assignedUsers: number;
  createdAt: string;
  joinKey?: string;
}

const TOKEN_KEY = 'roomkit.tenant.token';

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private readonly http = inject(HttpClient);
  readonly session = signal<TenantSession | null>(null);

  get token(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  async restore(): Promise<void> {
    if (!this.token) return;
    try {
      this.session.set(
        await firstValueFrom(
          this.http.get<TenantSession>('/api/tenant-auth/me', {
            headers: this.headers(),
          }),
        ),
      );
    } catch {
      this.logout();
    }
  }

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<{ token: string; tenant: TenantSession }>(
        '/api/tenant-auth/login',
        { email, password },
      ),
    );
    sessionStorage.setItem(TOKEN_KEY, result.token);
    this.session.set(result.tenant);
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.session.set(null);
  }

  overview(): Promise<TenantOverview> {
    return this.get<TenantOverview>('/api/tenant-portal/overview');
  }

  members(): Promise<TenantMember[]> {
    return this.get<TenantMember[]>('/api/tenant-portal/members');
  }

  addMembers(usernames: string[]) {
    return this.post<{
      added: TenantMember[];
      notFound: string[];
      unavailable: string[];
    }>('/api/tenant-portal/members', { usernames });
  }

  decide(userId: string, decision: 'approve' | 'reject') {
    return this.patch<TenantMember>(
      `/api/tenant-portal/membership-requests/${userId}`,
      { decision },
    );
  }

  rooms(): Promise<TenantRoom[]> {
    return this.get<TenantRoom[]>('/api/tenant-portal/rooms');
  }

  createRoom(input: { name: string; slug: string; maxParticipants?: number }) {
    return this.post<TenantRoom>('/api/tenant-portal/rooms', input);
  }

  assignRoomUsers(slug: string, usernames: string[]) {
    return this.post<{ assigned: string[]; unavailable: string[] }>(
      `/api/tenant-portal/rooms/${encodeURIComponent(slug)}/users`,
      { usernames },
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token ?? ''}` });
  }

  private get<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url, { headers: this.headers() }));
  }

  private post<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(url, body, { headers: this.headers() }),
    );
  }

  private patch<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.patch<T>(url, body, { headers: this.headers() }),
    );
  }
}
