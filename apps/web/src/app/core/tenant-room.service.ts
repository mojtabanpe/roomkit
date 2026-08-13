import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JoinTokenResponse } from './token.service';

export interface PublicTenantRoom {
  tenant: { name: string; key: string };
  room: { name: string; slug: string };
}

@Injectable({ providedIn: 'root' })
export class TenantRoomService {
  private readonly http = inject(HttpClient);

  view(tenantKey: string, slug: string): Promise<PublicTenantRoom> {
    return firstValueFrom(
      this.http.get<PublicTenantRoom>(
        `/api/tenant-rooms/${encodeURIComponent(tenantKey)}/${encodeURIComponent(slug)}`,
      ),
    );
  }

  token(
    tenantKey: string,
    slug: string,
    input: { key?: string; displayName?: string },
  ): Promise<JoinTokenResponse> {
    return firstValueFrom(
      this.http.post<JoinTokenResponse>(
        `/api/tenant-rooms/${encodeURIComponent(tenantKey)}/${encodeURIComponent(slug)}/token`,
        input,
      ),
    );
  }
}
