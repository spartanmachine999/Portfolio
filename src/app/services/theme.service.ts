import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'inferno' | 'crimson' | 'void';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  hint: string;
  swatch: string;
}

const STORAGE_KEY = 'ms-portfolio-theme';

/**
 * Owns the visual mode of the site.
 *
 * All three modes stay inside the red-on-black identity — they differ in
 * saturation and how loud the effects are. `void` deliberately switches the
 * meteor shower off, which doubles as a low-power / low-distraction mode.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly options: readonly ThemeOption[] = [
    { id: 'inferno', label: 'Inferno', hint: 'Full blast', swatch: '#ff3c3c' },
    { id: 'crimson', label: 'Crimson', hint: 'Deeper, moodier', swatch: '#d8232f' },
    { id: 'void', label: 'Void', hint: 'Calm, no meteors', swatch: '#5a1a1f' },
  ];

  readonly mode = signal<ThemeMode>(this.read());

  /** True when the OS asks for reduced motion. Animations defer to this. */
  readonly reducedMotion = signal<boolean>(false);

  constructor() {
    this.watchReducedMotion();

    effect(() => {
      const mode = this.mode();
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = mode;
      }
      this.write(mode);
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Steps to the next mode. Used by the dock button and the `T` shortcut. */
  cycle(): ThemeMode {
    const ids = this.options.map((o) => o.id);
    const next = ids[(ids.indexOf(this.mode()) + 1) % ids.length];
    this.mode.set(next);
    return next;
  }

  /** 0 disables the meteor shower entirely. */
  meteorDensity(): number {
    switch (this.mode()) {
      case 'void':
        return 0;
      case 'crimson':
        return 0.7;
      default:
        return 1;
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'inferno' || saved === 'crimson' || saved === 'void') return saved;
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
}
