import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
  });

  it('keeps a link back to the main app visible before login', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="http://localhost:5200/"]',
    );

    expect(link?.textContent).toContain('بازگشت به روم‌کیت');
  });
});
