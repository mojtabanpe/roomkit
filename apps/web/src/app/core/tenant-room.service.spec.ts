import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { TenantRoomService } from './tenant-room.service';

describe('TenantRoomService', () => {
  let service: TenantRoomService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(TenantRoomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
