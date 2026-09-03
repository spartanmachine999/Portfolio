import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';

interface NavLink {
  id: string;
  label: string;
}

/**
 * Sticky site header with a mobile drawer and scroll-spy.
 *
 * Scroll-spy uses IntersectionObserver rather than a scroll handler doing
 * getBoundingClientRect on every section — same result, far less work.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly audio = inject(AudioService);

  readonly links: readonly NavLink[] = [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
  ];

  readonly menuOpen = signal(false);
  readonly activeId = signal<string>('');
  readonly scrolled = signal(false);

  readonly menuLabel = computed(() => (this.menuOpen() ? 'Close menu' : 'Open menu'));

  private spy?: IntersectionObserver;
  private ratios = new Map<string, number>();

  private readonly onScroll = () => {
    const past = window.scrollY > 12;
    if (past !== this.scrolled()) this.zone.run(() => this.scrolled.set(past));
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
    });

    if (typeof IntersectionObserver === 'undefined') return;

    this.spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          this.ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        }

        let best = '';
        let bestRatio = 0;
        for (const [id, ratio] of this.ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }

        if (best && best !== this.activeId()) {
          this.zone.run(() => this.activeId.set(best));
        }
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.85], rootMargin: '-15% 0px -35% 0px' },
    );

    for (const l of this.links) {
      const el = document.getElementById(l.id);
      if (el) this.spy.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.spy?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
    this.audio.play('click');
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onNavClick(): void {
    this.audio.play('blip');
    this.closeMenu();
  }
}
