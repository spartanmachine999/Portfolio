import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ThemeService } from '../services/theme.service';

export type RevealDirection = '' | 'up' | 'left' | 'right' | 'scale';

/**
 * Reveals an element when it scrolls into view.
 *
 * The hiding class is applied by this directive at runtime rather than sitting
 * in the stylesheet. That ordering matters: if JavaScript fails to run, nothing
 * ever gets hidden and the page degrades to plain visible content. The previous
 * version of this site hid every `section` in CSS, which meant a JS error left
 * the page looking blank.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  /** Direction the element travels from. Empty string means straight up. */
  @Input('appReveal') direction: RevealDirection = '';

  /** Cascade the element's direct children instead of moving it as one block. */
  @Input({ transform: booleanAttr }) stagger = false;

  /** Fraction of the element that must be on screen before it fires. */
  @Input() threshold = 0.15;

  /** Extra delay in milliseconds, for hand-tuning a sequence. */
  @Input() revealDelay = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);
  private observer?: IntersectionObserver;
  private timer?: number;

  ngOnInit(): void {
    const el = this.host.nativeElement;

    // No IntersectionObserver, or the user asked for less motion: show it now.
    if (this.theme.reducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.show();
      return;
    }

    el.classList.add('reveal');
    if (this.stagger) el.classList.add('stagger');
    if (this.direction) el.dataset['reveal'] = this.direction;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (this.revealDelay > 0) {
            this.timer = window.setTimeout(() => this.show(), this.revealDelay);
          } else {
            this.show();
          }
          // One-shot: never re-hide something the visitor has already seen.
          this.observer?.disconnect();
        }
      },
      { threshold: this.threshold, rootMargin: '0px 0px -8% 0px' },
    );

    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.timer) clearTimeout(this.timer);
  }

  private show(): void {
    this.host.nativeElement.classList.add('is-visible');
  }
}

function booleanAttr(value: unknown): boolean {
  return value !== false && value != null && `${value}` !== 'false';
}
