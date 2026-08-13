import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { TenantApiService } from './tenant-api.service';

describe('TenantApiService', () => {
  let service: TenantApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(TenantApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
