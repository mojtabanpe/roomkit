import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TenantDashboard } from './tenant-dashboard';

describe('TenantDashboard', () => {
  let component: TenantDashboard;
  let fixture: ComponentFixture<TenantDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantDashboard],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('describes the login by what the tenant can manage', () => {
    expect(fixture.nativeElement.textContent).toContain(
      'برای مدیریت کاربران، روم‌ها و اشتراک خود وارد شوید.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('هویت مستقل tenant');
  });

  it('keeps a link back to the main app visible before login', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="http://localhost:5200/"]',
    );

    expect(link?.textContent).toContain('بازگشت به روم‌کیت');
  });
});
