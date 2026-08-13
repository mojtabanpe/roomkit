import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type PublicPlanCode = 'free' | 'pro' | 'usage';

export interface TenantWorkspaceInput {
  tenantName: string;
  tenantKey: string;
  plan: PublicPlanCode;
}

export interface RegisterTenantInput extends TenantWorkspaceInput {
  email: string;
  password: string;
}

export interface TenantWorkspaceResult {
  tenant: { name: string; key: string };
  subscription: { plan: PublicPlanCode };
}

@Injectable({
  providedIn: 'root',
})
export class TenantOnboardingService {
  private readonly http = inject(HttpClient);

  async register(input: RegisterTenantInput): Promise<TenantWorkspaceResult> {
    return firstValueFrom(
      this.http.post<TenantWorkspaceResult>(
        '/api/tenant-onboarding/register',
        input,
      ),
    );
  }
}
