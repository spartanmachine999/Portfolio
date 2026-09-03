import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';

/**
 * Thin reading-progress bar pinned to the top of the viewport.
 *
 * Updates the bar's transform directly on a rAF-coalesced scroll handler,
 * outside the Angular zone. Going through a signal + change detection for
 * something that fires on every scroll tick would be wasteful.
 */
@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="track" role="presentation">
      <div #bar class="bar"></div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 90;
        pointer-events: none;
      }

      .track {
        height: 2px;
        background: transparent;
      }

      .bar {
        height: 100%;
        width: 100%;
        transform: scaleX(0);
        transform-origin: left center;
        background: linear-gradient(90deg, var(--red-700), var(--accent), var(--red-300));
        box-shadow: 0 0 12px var(--glow);
        will-change: transform;
      }
    `,
  ],
})
export class ScrollProgressComponent implements AfterViewInit, OnDestroy {
  private readonly barRef = viewChild.required<ElementRef<HTMLElement>>('bar');
  private readonly zone = inject(NgZone);

  private frame = 0;

  private readonly onScroll = () => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      this.update();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  private update(): void {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    this.barRef().nativeElement.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }
}
