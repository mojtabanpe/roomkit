import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type PlanMode = 'unlimited' | 'pay_as_you_go' | 'prepaid';

export interface TenantSummary {
  id: string;
  key: string;
  name: string;
  planMode: PlanMode;
  active: boolean;
  maxParticipants: number | null;
  createdAt: string;
  includedUnits: number;
  usedUnits: number;
  creditLimitUnits: number;
  /** Null under `unlimited`. */
  remainingUnits: number | null;
}

export interface KeySummary {
  id: string;
  prefix: string;
  label: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface TenantDetail extends TenantSummary {
  keys: KeySummary[];
}

export interface IssuedKey {
  id: string;
  prefix: string;
  /** Shown once and never again — the server keeps only a hash. */
  key: string;
}

const TOKEN_KEY = 'roomkit.adminToken';

/**
 * Talks to `/api/admin/*` with the shared admin token.
 *
 * The token lives in **sessionStorage**, not localStorage: it is a master
 * credential that can mint API keys for any platform, and it should not
 * outlive the tab it was typed into.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));

  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
  }

  clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
  }

  list(): Promise<TenantSummary[]> {
    return firstValueFrom(
      this.http.get<TenantSummary[]>('/api/admin/tenants', this.opts()),
    );
  }

  get(id: string): Promise<TenantDetail> {
    return firstValueFrom(
      this.http.get<TenantDetail>(`/api/admin/tenants/${id}`, this.opts()),
    );
  }

  create(body: {
    key: string;
    name: string;
    planMode: PlanMode;
    maxParticipants?: number;
  }): Promise<TenantDetail> {
    return firstValueFrom(
      this.http.post<TenantDetail>('/api/admin/tenants', body, this.opts()),
    );
  }

  update(
    id: string,
    patch: Partial<{
      name: string;
      planMode: PlanMode;
      maxParticipants: number;
      active: boolean;
    }>,
  ): Promise<TenantSummary> {
    return firstValueFrom(
      this.http.patch<TenantSummary>(
        `/api/admin/tenants/${id}`,
        patch,
        this.opts(),
      ),
    );
  }

  topUp(id: string, units: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `/api/admin/tenants/${id}/balance/top-up`,
        { units },
        this.opts(),
      ),
    );
  }

  setCreditLimit(id: string, units: number): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `/api/admin/tenants/${id}/balance/credit-limit`,
        { units },
        this.opts(),
      ),
    );
  }

  issueKey(id: string, label: string): Promise<IssuedKey> {
    return firstValueFrom(
      this.http.post<IssuedKey>(
        `/api/admin/tenants/${id}/keys`,
        { label },
        this.opts(),
      ),
    );
  }

  revokeKey(id: string, keyId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(`/api/admin/tenants/${id}/keys/${keyId}`, this.opts()),
    );
  }

  private opts() {
    return { headers: { 'X-Admin-Token': this.token() ?? '' } };
  }
}
