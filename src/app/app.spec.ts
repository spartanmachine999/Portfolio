import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { UiService } from './services/ui.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // The shell renders a <router-outlet>, so the router has to be provided
      // even though these tests don't navigate.
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the persistent chrome around the outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-header')).toBeTruthy();
    expect(el.querySelector('app-footer')).toBeTruthy();
    expect(el.querySelector('app-starfield')).toBeTruthy();
    expect(el.querySelector('router-outlet')).toBeTruthy();
  });

  it('should keep overlays closed until asked for', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const ui = TestBed.inject(UiService);

    expect(ui.gameOpen()).toBe(false);
    expect(ui.paletteOpen()).toBe(false);
    expect(ui.synthOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-asteroid-game')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-synth-pad')).toBeNull();
  });

  it('should expose an unlabelled game launcher with an accessible name', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const fab = fixture.nativeElement.querySelector('.game-fab') as HTMLElement;

    expect(fab).toBeTruthy();
    expect(fab.getAttribute('aria-label')).toBe('Launch mini game');
    // The rocket must be the real astral-plane codepoint, not a truncated one.
    expect(fab.textContent).toContain('\u{1F680}');
  });
});
