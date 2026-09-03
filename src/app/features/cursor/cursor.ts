import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { RafService } from '../../services/raf.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Custom cyberpunk cursor: a precise dot, a lagging targeting reticle, and a
 * short motion trail.
 *
 * Only activates for fine pointers (real mice) and never when reduced motion is
 * requested — touch users and reduced-motion users keep the native cursor
 * untouched. The `cursor: none` that hides the system arrow is applied from
 * here via a class on <html>, so if this component never runs the native cursor
 * is still there.
 *
 * All positioning is written straight to the DOM inside a single rAF, outside
 * the Angular zone. Routing pointermove through change detection would be a
 * disaster at 60fps.
 */
@Component({
  selector: 'app-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #dot class="dot" aria-hidden="true"></div>
    <div #ring class="ring" aria-hidden="true">
      <span class="br tl"></span>
      <span class="br tr"></span>
      <span class="br bl"></span>
      <span class="br br2"></span>
      <span class="scan"></span>
    </div>
  `,
  styleUrl: './cursor.css',
})
export class CursorComponent implements AfterViewInit, OnDestroy {
  private readonly dotRef = viewChild.required<ElementRef<HTMLElement>>('dot');
  private readonly ringRef = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly raf = inject(RafService);
  private readonly theme = inject(ThemeService);

  private x = -100;
  private y = -100;
  private rx = -100;
  private ry = -100;
  private stop?: () => void;
  private active = false;
  private lastHot = false;

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.x = e.clientX;
    this.y = e.clientY;

    if (!this.active) {
      this.active = true;
      document.documentElement.classList.add('has-cursor');
    }

    // Interactive targets get a wider, hotter reticle.
    //
    // `target` is NOT guaranteed to be an Element — it can be `window` or
    // `document`, neither of which has `closest`. Calling it blindly threw on
    // every single pointer move, and an exception per mouse move means Angular
    // captures a stack trace per mouse move, which is ruinous for performance.
    const t = e.target;
    const hot = t instanceof Element && !!t.closest(CursorComponent.HOT_SELECTOR);
    if (hot !== this.lastHot) {
      this.lastHot = hot;
      this.ringRef().nativeElement.classList.toggle('hot', hot);
    }
  };

  private static readonly HOT_SELECTOR =
    'a, button, .badge, [role="radio"], input, .card, label';

  private readonly onDown = () => this.ringRef().nativeElement.classList.add('down');
  private readonly onUp = () => this.ringRef().nativeElement.classList.remove('down');
  private readonly onLeave = () => {
    this.dotRef().nativeElement.style.opacity = '0';
    this.ringRef().nativeElement.style.opacity = '0';
  };
  private readonly onEnter = () => {
    this.dotRef().nativeElement.style.opacity = '1';
    this.ringRef().nativeElement.style.opacity = '1';
  };

  ngAfterViewInit(): void {
    // Bail out entirely on touch or reduced motion.
    if (this.theme.reducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    document.addEventListener('mouseleave', this.onLeave);
    document.addEventListener('mouseenter', this.onEnter);

    // Shares the application-wide frame loop rather than starting a third one.
    this.stop = this.raf.add((dt) => this.tick(dt));
  }

  ngOnDestroy(): void {
    this.stop?.();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('mouseleave', this.onLeave);
    document.removeEventListener('mouseenter', this.onEnter);
    document.documentElement.classList.remove('has-cursor');
  }

  private tick(dt: number): void {
    if (!this.active) return;

    // The dot is exact; the ring eases toward it, which produces the lag.
    // Framerate-independent easing so the feel is identical at 60 and 144Hz.
    const k = Math.min(1, dt * 11);
    this.rx += (this.x - this.rx) * k;
    this.ry += (this.y - this.ry) * k;

    this.dotRef().nativeElement.style.transform =
      `translate3d(${this.x}px, ${this.y}px, 0) translate(-50%, -50%)`;
    this.ringRef().nativeElement.style.transform =
      `translate3d(${this.rx.toFixed(1)}px, ${this.ry.toFixed(1)}px, 0) translate(-50%, -50%)`;
  }
}
