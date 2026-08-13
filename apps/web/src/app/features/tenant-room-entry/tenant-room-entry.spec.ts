import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { TenantRoomService } from '../../core/tenant-room.service';
import { TenantRoomEntry } from './tenant-room-entry';

describe('TenantRoomEntry', () => {
  let component: TenantRoomEntry;
  let fixture: ComponentFixture<TenantRoomEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantRoomEntry],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => false, user: signal(null) },
        },
        {
          provide: TenantRoomService,
          useValue: {
            view: () =>
              Promise.resolve({
                tenant: { name: 'tenant', key: 'tenant' },
                room: { name: 'room', slug: 'room' },
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantRoomEntry);
    fixture.componentRef.setInput('tenantKey', 'tenant');
    fixture.componentRef.setInput('room', 'room');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
