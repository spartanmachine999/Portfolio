import { Injectable, inject, signal } from '@angular/core';
import { AudioService } from './audio.service';
import { ThemeService } from './theme.service';

const SECTIONS = ['hero', 'about', 'experience', 'projects', 'skills'];

/** Original lines. Deliberately not quotes from anything. */
const HOP_LINES = [
  'Dimension shift complete. Probably the right one. 🌀',
  'You have arrived. Somewhere. 🛸',
  'Reality re-indexed successfully. 🧪',
  'That wormhole was load-bearing. 🌀',
  'Coordinates scrambled, vibes intact. ✨',
  'Portal stabilised. Mostly. 🟢',
];

/**
 * Shared UI state: overlays, toasts and the portal hop.
 *
 * This exists so any component can open the game or the palette without
 * chaining `output()` bindings up through the tree. That matters now the app
 * uses a router — a routed component can't bind outputs to its parent, so
 * shared state has to live in a service.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly audio = inject(AudioService);
  private readonly theme = inject(ThemeService);

  readonly gameOpen = signal(false);
  readonly paletteOpen = signal(false);
  readonly synthOpen = signal(false);

  readonly toast = signal<string | null>(null);
  readonly toastLeaving = signal(false);

  readonly portalActive = signal(false);

  private toastTimers: number[] = [];

  // ---- Game ----
  openGame(): void {
    this.paletteOpen.set(false);
    this.synthOpen.set(false);
    this.gameOpen.set(true);
    document.body.classList.add('modal-open');
  }

  closeGame(): void {
    this.gameOpen.set(false);
    this.unlockIfClear();
  }

  // ---- Palette ----
  openPalette(): void {
    this.paletteOpen.set(true);
    this.audio.play('click');
  }

  closePalette(): void {
    this.paletteOpen.set(false);
  }

  // ---- Synth ----
  openSynth(): void {
    this.paletteOpen.set(false);
    this.synthOpen.set(true);
    document.body.classList.add('modal-open');
  }

  closeSynth(): void {
    this.synthOpen.set(false);
    this.unlockIfClear();
  }

  private unlockIfClear(): void {
    if (!this.gameOpen() && !this.synthOpen()) {
      document.body.classList.remove('modal-open');
    }
  }

  // ---- Toast ----
  showToast(msg: string, ms = 4200): void {
    for (const t of this.toastTimers) clearTimeout(t);
    this.toastTimers = [];

    this.toastLeaving.set(false);
    this.toast.set(msg);

    this.toastTimers.push(
      window.setTimeout(() => {
        this.toastLeaving.set(true);
        this.toastTimers.push(window.setTimeout(() => this.toast.set(null), 320));
      }, ms),
    );
  }

  // ---- Portal hop ----
  /** Warps to a random section that isn't the one you're already nearest. */
  portalHop(): void {
    this.paletteOpen.set(false);
    this.audio.play('levelup');

    const target = this.pickSection();
    const reduced = this.theme.reducedMotion();

    if (reduced) {
      document.getElementById(target)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      this.showToast(HOP_LINES[0], 2600);
      return;
    }

    this.portalActive.set(true);
    // Scroll at the point the portal is widest, so the jump is hidden behind it.
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 420);
    window.setTimeout(() => this.portalActive.set(false), 1000);

    this.showToast(HOP_LINES[Math.floor(Math.random() * HOP_LINES.length)], 3200);
  }

  private pickSection(): string {
    const nearest = this.nearestSection();
    const options = SECTIONS.filter((s) => s !== nearest);
    return options[Math.floor(Math.random() * options.length)] ?? SECTIONS[0];
  }

  private nearestSection(): string {
    let best = SECTIONS[0];
    let bestDist = Infinity;
    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const d = Math.abs(el.getBoundingClientRect().top);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }
}
