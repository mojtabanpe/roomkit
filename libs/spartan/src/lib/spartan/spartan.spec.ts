import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Spartan } from './spartan';

describe('Spartan', () => {
  let component: Spartan;
  let fixture: ComponentFixture<Spartan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Spartan],
    }).compileComponents();

    fixture = TestBed.createComponent(Spartan);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
