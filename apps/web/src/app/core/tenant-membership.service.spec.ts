import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { TenantMembershipService } from './tenant-membership.service';

describe('TenantMembershipService', () => {
  let service: TenantMembershipService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(TenantMembershipService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
