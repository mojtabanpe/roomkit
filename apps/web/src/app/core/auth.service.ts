import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'roomkit.token';

/**
 * Accounts are optional — guests use the app without ever signing in — so
 * everything here degrades to "no user" rather than blocking.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);
  readonly isLoggedIn = computed(() => this.user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Restores the session on boot; safe to call when no token is stored. */
  async restore(): Promise<void> {
    const token = this.token;
    if (!token) {
      this.ready.set(true);
      return;
    }
    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>('/api/auth/me'),
      );
      this.user.set(user);
    } catch {
      // Expired or revoked — drop it and carry on as a guest.
      localStorage.removeItem(TOKEN_KEY);
      this.user.set(null);
    } finally {
      this.ready.set(true);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResult>('/api/auth/login', { email, password }),
    );
    this.apply(res);
  }

  async register(
    email: string,
    username: string,
    displayName: string,
    password: string,
    tenantKey?: string,
  ): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResult>('/api/auth/register', {
        email,
        username,
        displayName,
        password,
        ...(tenantKey ? { tenantKey } : {}),
      }),
    );
    this.apply(res);
  }

  async updateProfile(displayName: string, username: string): Promise<void> {
    this.user.set(
      await firstValueFrom(
        this.http.patch<AuthUser>('/api/auth/profile', {
          displayName,
          username,
        }),
      ),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  /** Used by account-creating flows that return the normal auth contract. */
  establishSession(res: AuthResult): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    this.user.set(res.user);
  }

  private apply(res: AuthResult): void {
    this.establishSession(res);
  }
}
