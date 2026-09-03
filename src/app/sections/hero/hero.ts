import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RevealDirective } from '../../directives/reveal.directive';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class HeroComponent implements OnInit, OnDestroy {
  protected readonly data = inject(PortfolioDataService);
  private readonly theme = inject(ThemeService);

  readonly avatarSrc = '/profile.jpg';

  /** Text currently shown by the typewriter. */
  readonly typed = signal('');
  readonly caretOn = signal(true);

  private phraseIndex = 0;
  private charIndex = 0;
  private deleting = false;
  private timer?: number;
  private caretTimer?: number;

  ngOnInit(): void {
    const phrases = this.data.taglines();

    // Reduced motion: show the first tagline and leave it alone.
    if (this.theme.reducedMotion()) {
      this.typed.set(phrases[0] ?? '');
      this.caretOn.set(false);
      return;
    }

    this.timer = window.setTimeout(() => this.tick(), 600);
    this.caretTimer = window.setInterval(() => this.caretOn.update((v) => !v), 520);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.caretTimer) clearInterval(this.caretTimer);
  }

  /** Types a phrase out, pauses, deletes it, moves to the next. */
  private tick(): void {
    const phrases = this.data.taglines();
    const phrase = phrases[this.phraseIndex % phrases.length] ?? '';

    if (!this.deleting) {
      this.charIndex++;
      this.typed.set(phrase.slice(0, this.charIndex));

      if (this.charIndex >= phrase.length) {
        this.deleting = true;
        this.timer = window.setTimeout(() => this.tick(), 1900);
        return;
      }
      // Slight jitter so it reads like a person, not a metronome.
      this.timer = window.setTimeout(() => this.tick(), 42 + Math.random() * 55);
      return;
    }

    this.charIndex--;
    this.typed.set(phrase.slice(0, Math.max(0, this.charIndex)));

    if (this.charIndex <= 0) {
      this.deleting = false;
      this.phraseIndex++;
      this.timer = window.setTimeout(() => this.tick(), 380);
      return;
    }
    this.timer = window.setTimeout(() => this.tick(), 24);
  }
}
