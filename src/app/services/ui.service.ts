import { Injectable, inject, signal } from '@angular/core';
import { AudioService } from './audio.service';

/**
 * Shared UI state: overlays and toasts.
 *
 * This exists so any component can open the game or the palette without
 * chaining `output()` bindings up through the tree. That matters now the app
 * uses a router — a routed component can't bind outputs to its parent, so
 * shared state has to live in a service.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly audio = inject(AudioService);

  readonly gameOpen = signal(false);
  readonly paletteOpen = signal(false);
  readonly synthOpen = signal(false);

  readonly toast = signal<string | null>(null);
  readonly toastLeaving = signal(false);

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
}
