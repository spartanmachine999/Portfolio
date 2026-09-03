import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'inferno' | 'cyber' | 'synth' | 'acid' | 'solar' | 'void';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  hint: string;
  swatch: string;
}

const STORAGE_KEY = 'ms-portfolio-theme';
const ASCII_KEY = 'ms-portfolio-ascii';
const DOODLE_KEY = 'ms-portfolio-doodle';
const MODES: readonly ThemeMode[] = ['inferno', 'cyber', 'synth', 'acid', 'solar', 'void'];

/** Matches the CRT shutdown animation length in styles.css. */
const CRT_MS = 460;

/**
 * Owns the visual mode of the site.
 *
 * Six modes, all dark, but genuinely contrasting rather than six shades of the
 * same colour. The actual palettes live in styles.css under
 * `html[data-theme='...']`; this service only decides which one is active and
 * how loud the motion effects should be.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly options: readonly ThemeOption[] = [
    { id: 'inferno', label: 'Inferno', hint: 'Red hot', swatch: '#ff3c3c' },
    { id: 'cyber', label: 'Cyber', hint: 'Ice blue', swatch: '#00e5ff' },
    { id: 'synth', label: 'Synth', hint: 'Neon magenta', swatch: '#ff2bd6' },
    { id: 'acid', label: 'Acid', hint: 'Toxic lime', swatch: '#a3ff12' },
    { id: 'solar', label: 'Solar', hint: 'Molten amber', swatch: '#ff9f1c' },
    { id: 'void', label: 'Void', hint: 'Mono, calm', swatch: '#c9c9c9' },
  ];

  readonly mode = signal<ThemeMode>(this.read());

  /** ASCII-art rendering of the background. */
  readonly ascii = signal<boolean>(this.readFlag(ASCII_KEY));

  /** Chalkboard + handwriting skin. */
  readonly doodle = signal<boolean>(this.readFlag(DOODLE_KEY));

  /** True when the OS asks for reduced motion. Animations defer to this. */
  readonly reducedMotion = signal<boolean>(false);

  private crtTimer?: number;

  constructor() {
    this.watchReducedMotion();

    effect(() => {
      const mode = this.mode();
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = mode;
      }
      this.write(mode);
    });

    effect(() => {
      const on = this.ascii();
      document.documentElement.classList.toggle('ascii', on);
      this.writeFlag(ASCII_KEY, on);
    });

    effect(() => {
      const on = this.doodle();
      document.documentElement.classList.toggle('doodle', on);
      this.writeFlag(DOODLE_KEY, on);
    });
  }

  set(mode: ThemeMode): void {
    if (mode === this.mode()) return;
    this.crtSwitch(() => this.mode.set(mode));
  }

  /** Steps to the next mode. Used by the dock and the `T` shortcut. */
  cycle(): ThemeMode {
    const next = MODES[(MODES.indexOf(this.mode()) + 1) % MODES.length];
    this.crtSwitch(() => this.mode.set(next));
    return next;
  }

  toggleAscii(): boolean {
    const next = !this.ascii();
    this.ascii.set(next);
    return next;
  }

  toggleDoodle(): boolean {
    const next = !this.doodle();
    this.crtSwitch(() => this.doodle.set(next));
    return next;
  }

  /**
   * Runs `apply` behind a CRT power-off animation: the picture collapses to a
   * bright line, the change happens while the screen is dark, then it powers
   * back on. Swapping colours mid-blink hides the abrupt transition.
   */
  private crtSwitch(apply: () => void): void {
    if (this.reducedMotion() || typeof document === 'undefined') {
      apply();
      return;
    }

    const root = document.documentElement;
    if (this.crtTimer) {
      // Mid-animation: just apply and let the running one finish.
      apply();
      return;
    }

    root.classList.add('crt-switching');
    // Apply at the darkest point so the swap itself is never visible.
    this.crtTimer = window.setTimeout(() => {
      apply();
      window.setTimeout(() => {
        root.classList.remove('crt-switching');
        this.crtTimer = undefined;
      }, CRT_MS / 2);
    }, CRT_MS / 2);
  }

  label(mode: ThemeMode = this.mode()): string {
    return this.options.find((o) => o.id === mode)?.label ?? mode;
  }

  /** Multiplier on meteor spawn rate. Void is the deliberately quiet one. */
  meteorDensity(): number {
    switch (this.mode()) {
      case 'void':
        return 0.25;
      case 'acid':
        return 0.8;
      case 'solar':
        return 1.15;
      default:
        return 1;
    }
  }

  /**
   * Accent as an `r, g, b` triple, for canvas work that needs alpha.
   *
   * Doodle mode no longer overrides this: chalk and the board now take their
   * colour from whichever theme is active, so the skin works with all six
   * palettes instead of forcing one yellow.
   */
  accentRgb(): string {
    switch (this.mode()) {
      case 'cyber':
        return '0, 229, 255';
      case 'synth':
        return '255, 43, 214';
      case 'acid':
        return '163, 255, 18';
      case 'solar':
        return '255, 159, 28';
      case 'void':
        return '210, 210, 214';
      default:
        return '255, 60, 60';
    }
  }

  /** Secondary tone used for constellation lines and meteor cores. */
  accentAltRgb(): string {
    switch (this.mode()) {
      case 'cyber':
        return '120, 255, 240';
      case 'synth':
        return '150, 90, 255';
      case 'acid':
        return '220, 255, 140';
      case 'solar':
        return '255, 220, 130';
      case 'void':
        return '160, 160, 168';
      default:
        return '255, 150, 120';
    }
  }

  private watchReducedMotion(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion.set(mq.matches);
    mq.addEventListener('change', (e) => this.reducedMotion.set(e.matches));
  }

  private read(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved && MODES.includes(saved)) return saved;
    } catch {
      /* localStorage can throw in private browsing — fall through to default */
    }
    return 'inferno';
  }

  private write(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* not fatal, the mode just won't survive a reload */
    }
  }

  private readFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private writeFlag(key: string, on: boolean): void {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
