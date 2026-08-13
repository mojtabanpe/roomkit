import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface UserTenantMembership {
  status: 'pending' | 'active' | 'rejected';
  source: 'tenant' | 'user';
  tenant: { name: string; key: string };
}

@Injectable({ providedIn: 'root' })
export class TenantMembershipService {
  private readonly http = inject(HttpClient);

  current(): Promise<UserTenantMembership | null> {
    return firstValueFrom(
      this.http.get<UserTenantMembership | null>('/api/auth/tenant-membership'),
    );
  }

  request(tenantKey: string): Promise<UserTenantMembership> {
    return firstValueFrom(
      this.http.post<UserTenantMembership>('/api/auth/tenant-membership', {
        tenantKey,
      }),
    );
  }
}
