import { Injectable, inject, signal } from '@angular/core';
import { RafService } from './raf.service';
import { ThemeService } from './theme.service';

interface FloatItem {
  clone: HTMLElement;
  origin: HTMLElement;
  /** Viewport position the element started at, and returns to. */
  homeX: number;
  homeY: number;
  w: number;
  h: number;
  /** Offset from home, applied as a translate. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  grabbed: boolean;
}

/** Elements worth floating. Earlier entries win over their own descendants. */
const TARGETS = [
  '.card',
  '.orb',
  '.section-title',
  '.status',
  'h1',
  '.typeline',
  '.lede',
  '.fact',
  '.btn',
  '.badge',
];

/**
 * Zero-gravity mode: everything on screen detaches and drifts.
 *
 * Implemented with clones rather than by moving the real elements. Taking the
 * originals out of flow would collapse the layout behind them and the page would
 * visibly reflow; instead each original stays put as an invisible spacer while a
 * fixed-position clone floats. Layout never changes, so landing is exact.
 *
 * Scroll is locked while active, because clone positions are viewport-relative
 * and would drift out of sync with their origins otherwise.
 */
@Injectable({ providedIn: 'root' })
export class FloatService {
  readonly active = signal(false);

  private readonly raf = inject(RafService);
  private readonly theme = inject(ThemeService);

  private layer: HTMLElement | null = null;
  private items: FloatItem[] = [];
  private stop?: () => void;
  private savedScroll = 0;

  private dragging: FloatItem | null = null;
  private lastPointer = { x: 0, y: 0, t: 0 };

  private readonly onResize = () => {
    // Recomputing every home position mid-flight isn't worth it; just land.
    if (this.active()) this.deactivate();
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest('.float-item') as HTMLElement | null;
    if (!el) return;
    const item = this.items.find((i) => i.clone === el);
    if (!item) return;

    item.grabbed = true;
    this.dragging = item;
    this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    const item = this.dragging;
    if (!item) return;

    const now = performance.now();
    const dt = Math.max(1, now - this.lastPointer.t) / 1000;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;

    item.x += dx;
    item.y += dy;
    // Carry the pointer's speed so releasing throws the element.
    item.vx = dx / dt;
    item.vy = dy / dt;

    this.lastPointer = { x: e.clientX, y: e.clientY, t: now };
  };

  private readonly onPointerUp = () => {
    if (!this.dragging) return;
    this.dragging.grabbed = false;
    // Damp the throw so a hard flick doesn't fire it off screen instantly.
    this.dragging.vx *= 0.35;
    this.dragging.vy *= 0.35;
    this.dragging = null;
  };

  toggle(): boolean {
    if (this.active()) this.deactivate();
    else this.activate();
    return this.active();
  }

  // ---------------------------------------------------------------------------
  // Activate
  // ---------------------------------------------------------------------------

  private activate(): void {
    if (this.active()) return;

    const targets = this.collect();
    if (!targets.length) return;

    this.savedScroll = window.scrollY;

    this.layer = document.createElement('div');
    this.layer.className = 'float-layer';
    document.body.appendChild(this.layer);

    const drift = this.theme.reducedMotion() ? 0 : 1;

    for (const origin of targets) {
      const r = origin.getBoundingClientRect();

      const clone = origin.cloneNode(true) as HTMLElement;
      clone.classList.add('float-item');
      // Strip ids from the whole subtree so the clone can't duplicate any id.
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      clone.setAttribute('aria-hidden', 'true');

      clone.style.position = 'fixed';
      clone.style.left = `${r.left}px`;
      clone.style.top = `${r.top}px`;
      clone.style.width = `${r.width}px`;
      clone.style.height = `${r.height}px`;
      clone.style.margin = '0';

      this.layer.appendChild(clone);
      origin.style.visibility = 'hidden';

      this.items.push({
        clone,
        origin,
        homeX: r.left,
        homeY: r.top,
        w: r.width,
        h: r.height,
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 90 * drift,
        vy: (Math.random() - 0.5) * 70 * drift - 20 * drift,
        rot: 0,
        vrot: (Math.random() - 0.5) * 26 * drift,
        grabbed: false,
      });
    }

    document.documentElement.classList.add('floating');
    this.active.set(true);

    this.layer.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });

    if (drift) this.stop = this.raf.add((dt) => this.tick(dt));
  }

  /**
   * Picks visible candidates, skipping anything nested inside one already
   * chosen — floating both a card and its own badges would tear the card apart.
   */
  private collect(): HTMLElement[] {
    const vh = window.innerHeight;
    const chosen: HTMLElement[] = [];

    for (const sel of TARGETS) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        if (el.closest('.float-layer')) continue;
        // Leave the controls alone; they're how you turn this off.
        if (el.closest('app-control-dock, app-cursor, .game-fab, .toast, .keys')) continue;

        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        // Only what's on screen, plus a little slack.
        if (r.bottom < -40 || r.top > vh + 40) continue;

        if (chosen.some((c) => c.contains(el) || el.contains(c))) continue;
        chosen.push(el);
      }
    }

    return chosen.slice(0, 80);
  }

  // ---------------------------------------------------------------------------
  // Simulate
  // ---------------------------------------------------------------------------

  private tick(dt: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (const it of this.items) {
      if (!it.grabbed) {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.rot += it.vrot * dt;

        // Weightless: a touch of lift plus drag, so things drift instead of
        // settling. Deliberately no gravity term.
        it.vy -= 4 * dt;
        it.vx *= 0.995;
        it.vy *= 0.995;
        it.vrot *= 0.995;

        const left = it.homeX + it.x;
        const top = it.homeY + it.y;

        if (left < 0) {
          it.x -= left;
          it.vx = Math.abs(it.vx) * 0.7;
          it.vrot = -it.vrot * 0.7;
        } else if (left + it.w > vw) {
          it.x -= left + it.w - vw;
          it.vx = -Math.abs(it.vx) * 0.7;
          it.vrot = -it.vrot * 0.7;
        }

        if (top < 0) {
          it.y -= top;
          it.vy = Math.abs(it.vy) * 0.7;
        } else if (top + it.h > vh) {
          it.y -= top + it.h - vh;
          it.vy = -Math.abs(it.vy) * 0.7;
        }
      }

      it.clone.style.transform =
        `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0) rotate(${it.rot.toFixed(2)}deg)`;
    }
  }

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  private deactivate(): void {
    if (!this.active()) return;

    this.stop?.();
    this.stop = undefined;
    this.dragging = null;

    this.layer?.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);

    const settle = this.theme.reducedMotion() ? 0 : 640;

    // Everything eases back to transform: none, which lands it exactly on its
    // origin, because left/top were taken from the original rect.
    for (const it of this.items) {
      it.clone.style.transition = `transform ${settle}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      it.clone.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    }

    const items = this.items;
    const layer = this.layer;
    this.items = [];
    this.layer = null;
    this.active.set(false);

    window.setTimeout(() => {
      for (const it of items) it.origin.style.removeProperty('visibility');
      layer?.remove();
      document.documentElement.classList.remove('floating');
      // Locking scroll can nudge the offset; put it back where it was.
      window.scrollTo({ top: this.savedScroll, behavior: 'auto' });
    }, settle);
  }
}
