import { Injectable, signal } from '@angular/core';

export interface Stroke {
  /** Flat [x0, y0, x1, y1, ...] in PAGE coordinates, not viewport. */
  pts: number[];
}

const STORAGE_KEY = 'ms-portfolio-doodles';
/** Cap total points so redraws stay cheap and localStorage stays small. */
const MAX_POINTS = 6000;

/**
 * Holds the chalk strokes drawn on the board in doodle mode.
 *
 * Points are stored in page coordinates rather than viewport coordinates, so a
 * drawing stays attached to the part of the page it was drawn on instead of
 * sliding around when you scroll.
 *
 * Colour is deliberately NOT stored: strokes are rendered in the live theme
 * accent, so switching theme recolours existing doodles instead of leaving a
 * mismatched mess behind.
 */
@Injectable({ providedIn: 'root' })
export class DoodleService {
  /** Bumped on any change so the canvas knows to repaint. */
  readonly revision = signal(0);
  readonly strokeCount = signal(0);

  private strokes: Stroke[] = [];
  private current: Stroke | null = null;

  constructor() {
    this.strokes = this.read();
    this.strokeCount.set(this.strokes.length);
  }

  all(): readonly Stroke[] {
    return this.strokes;
  }

  begin(x: number, y: number): void {
    this.current = { pts: [x, y] };
    this.strokes.push(this.current);
    this.bump();
  }

  extend(x: number, y: number): void {
    const s = this.current;
    if (!s) return;

    // Skip sub-pixel moves; they add points without adding visible detail.
    const n = s.pts.length;
    if (n >= 2) {
      const dx = x - s.pts[n - 2];
      const dy = y - s.pts[n - 1];
      if (dx * dx + dy * dy < 6) return;
    }

    s.pts.push(x, y);
    this.bump();
  }

  end(): void {
    if (!this.current) return;
    // A tap with no drag leaves a single point and draws nothing useful.
    if (this.current.pts.length < 4) this.strokes.pop();
    this.current = null;
    this.trim();
    this.strokeCount.set(this.strokes.length);
    this.write();
    this.bump();
  }

  undo(): void {
    this.strokes.pop();
    this.strokeCount.set(this.strokes.length);
    this.write();
    this.bump();
  }

  clear(): void {
    this.strokes = [];
    this.current = null;
    this.strokeCount.set(0);
    this.write();
    this.bump();
  }

  private bump(): void {
    this.revision.update((v) => v + 1);
  }

  /** Drops the oldest strokes once the total point budget is exceeded. */
  private trim(): void {
    let total = this.strokes.reduce((n, s) => n + s.pts.length, 0);
    while (total > MAX_POINTS && this.strokes.length > 1) {
      total -= this.strokes[0].pts.length;
      this.strokes.shift();
    }
  }

  private read(): Stroke[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((s) => Array.isArray(s?.pts) && s.pts.length >= 4)
        .map((s) => ({ pts: (s.pts as unknown[]).map(Number).filter(Number.isFinite) }));
    } catch {
      return [];
    }
  }

  private write(): void {
    try {
      // Round to whole pixels; sub-pixel precision isn't worth the bytes.
      const slim = this.strokes.map((s) => ({ pts: s.pts.map((n) => Math.round(n)) }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* quota or private mode — drawings just won't survive a reload */
    }
  }
}
