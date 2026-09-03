import { Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';

/**
 * Pointer-reactive card treatment: a light 3D tilt plus a spotlight that
 * tracks the cursor.
 *
 * Writes `--mx` / `--my` as percentages, which the global `.card::before`
 * gradient reads. Pointer moves are coalesced into a single rAF so a fast
 * mouse can't trigger more style writes than there are frames.
 *
 * Skipped entirely for touch pointers and when reduced motion is requested.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
  host: {
    '(pointerenter)': 'onEnter($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerleave)': 'onLeave()',
  },
})
export class TiltDirective implements OnDestroy {
  /** Maximum rotation in degrees. Keep it subtle; large values look cheap. */
  @Input() tiltMax = 5;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);

  private frame = 0;
  private pending: { x: number; y: number } | null = null;
  private active = false;

  onEnter(event: PointerEvent): void {
    if (!this.allowed(event)) return;
    this.active = true;
    const el = this.host.nativeElement;
    el.style.transition = 'transform 0.12s ease-out, border-color 0.3s, box-shadow 0.3s';
  }

  onMove(event: PointerEvent): void {
    if (!this.active || !this.allowed(event)) return;
    this.pending = { x: event.clientX, y: event.clientY };
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.apply();
    });
  }

  onLeave(): void {
    if (!this.active) return;
    this.active = false;
    this.pending = null;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    const el = this.host.nativeElement;
    el.style.transition = 'transform 0.5s cubic-bezier(0.22,0.61,0.36,1), border-color 0.3s, box-shadow 0.3s';
    el.style.transform = '';
    el.style.removeProperty('--mx');
    el.style.removeProperty('--my');
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  private apply(): void {
    const p = this.pending;
    if (!p) return;
    const el = this.host.nativeElement;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    const px = (p.x - r.left) / r.width;
    const py = (p.y - r.top) / r.height;

    el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);

    const ry = (px - 0.5) * 2 * this.tiltMax;
    const rx = -(py - 0.5) * 2 * this.tiltMax;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
  }

  private allowed(event: PointerEvent): boolean {
    return event.pointerType === 'mouse' && !this.theme.reducedMotion();
  }
}
