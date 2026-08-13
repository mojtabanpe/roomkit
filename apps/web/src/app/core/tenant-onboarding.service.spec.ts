import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { TenantOnboardingService } from './tenant-onboarding.service';

describe('TenantOnboardingService', () => {
  let service: TenantOnboardingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(TenantOnboardingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
