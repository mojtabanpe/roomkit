import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface JoinTokenResponse {
  token: string;
  serverUrl: string;
  room: string;
  identity: string;
}

/**
 * Talks to the NestJS backend to mint a LiveKit join token.
 * Requests are proxied to the API via apps/web/proxy.conf.json (`/api`).
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly http = inject(HttpClient);

  /** `passcode` is only read by the API for rooms marked private. */
  fetchToken(
    room: string,
    identity: string,
    name?: string,
    passcode?: string,
  ): Promise<JoinTokenResponse> {
    return firstValueFrom(
      this.http.post<JoinTokenResponse>('/api/livekit/token', {
        room,
        identity,
        name,
        passcode,
      }),
    );
  }
}
