import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';

export type FrameFn = (dt: number, now: number) => void;

/**
 * One requestAnimationFrame loop for the entire application.
 *
 * Before this existed the starfield, the click effects and the custom cursor
 * each ran their own rAF. Three loops means three separate callback chains and
 * three chances to miss a frame budget, which is what made the page feel choppy.
 *
 * Also provides an adaptive quality signal. Frame times are sampled
 * continuously, and if the device can't keep up, `quality` drops so effects can
 * scale themselves back instead of stuttering.
 */
@Injectable({ providedIn: 'root' })
export class RafService implements OnDestroy {
  /** 1 = full effects, 0.5 = reduced, 0.25 = minimal. */
  readonly quality = signal(1);
  readonly fps = signal(60);

  private readonly zone = inject(NgZone);
  private readonly subs = new Set<FrameFn>();

  private handle = 0;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private downgrades = 0;

  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  ngOnDestroy(): void {
    this.pause();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Register a per-frame callback. Returns an unsubscribe function. */
  add(fn: FrameFn): () => void {
    this.subs.add(fn);
    this.resume();
    return () => {
      this.subs.delete(fn);
      if (!this.subs.size) this.pause();
    };
  }

  private resume(): void {
    if (this.handle || !this.subs.size || document.hidden) return;
    this.last = performance.now();
    // Everything downstream writes directly to canvas or style, so none of it
    // needs change detection. Staying outside the zone avoids re-rendering the
    // whole component tree 60 times a second.
    this.zone.runOutsideAngular(() => {
      this.handle = requestAnimationFrame((t) => this.tick(t));
    });
  }

  private pause(): void {
    if (this.handle) cancelAnimationFrame(this.handle);
    this.handle = 0;
  }

  private tick(now: number): void {
    // Clamp so a stalled tab doesn't produce one enormous delta.
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    this.sample(dt);

    for (const fn of this.subs) {
      try {
        fn(dt, now);
      } catch {
        // A throwing effect must not kill the loop for everything else.
      }
    }

    this.handle = requestAnimationFrame((t) => this.tick(t));
  }

  private sample(dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 1) return;

    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;

    // Only ever step quality down, and at most twice. Oscillating between
    // quality levels looks worse than simply running at the lower one.
    if (fps < 45 && this.downgrades < 2) {
      this.downgrades++;
      this.quality.set(this.downgrades === 1 ? 0.5 : 0.25);
    }

    // Reported for debugging; not used to drive layout.
    if (Math.abs(fps - this.fps()) > 2) this.fps.set(Math.round(fps));
  }
}
