import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { AsteroidGameComponent } from './features/asteroid-game/asteroid-game';
import { ControlDockComponent } from './features/control-dock/control-dock';
import { ScrollProgressComponent } from './features/scroll-progress/scroll-progress';
import { StarfieldComponent } from './features/starfield/starfield';
import { FooterComponent } from './layout/footer/footer';
import { HeaderComponent } from './layout/header/header';
import { AboutComponent } from './sections/about/about';
import { ExperienceComponent } from './sections/experience/experience';
import { HeroComponent } from './sections/hero/hero';
import { ProjectsComponent } from './sections/projects/projects';
import { SkillsComponent } from './sections/skills/skills';
import { AudioService } from './services/audio.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StarfieldComponent,
    ScrollProgressComponent,
    HeaderComponent,
    HeroComponent,
    AboutComponent,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
    FooterComponent,
    ControlDockComponent,
    AsteroidGameComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);

  readonly gameOpen = signal(false);

  openGame(): void {
    this.gameOpen.set(true);
    document.body.classList.add('modal-open');
  }

  closeGame(): void {
    this.gameOpen.set(false);
    document.body.classList.remove('modal-open');
  }

  /**
   * Global shortcuts. Deliberately narrow: they only fire on a bare keypress
   * with no modifiers, never while the game is open (it owns the keyboard
   * then), and never while focus is in a text field.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.gameOpen()) return;

    const el = event.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;

    switch (event.key) {
      case 'g':
      case 'G':
        this.openGame();
        break;
      case 't':
      case 'T':
        this.theme.cycle();
        this.audio.play('blip');
        break;
      case 'm':
      case 'M':
        this.audio.toggle();
        break;
    }
  }
}
