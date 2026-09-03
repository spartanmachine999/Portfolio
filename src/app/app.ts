import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { AsteroidGameComponent } from './features/asteroid-game/asteroid-game';
import { ClickFxComponent } from './features/click-fx/click-fx';
import { CommandPaletteComponent } from './features/command-palette/command-palette';
import { ControlDockComponent } from './features/control-dock/control-dock';
import { CursorComponent } from './features/cursor/cursor';
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

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    StarfieldComponent,
    ScrollProgressComponent,
    CursorComponent,
    ClickFxComponent,
    HeaderComponent,
    HeroComponent,
    AboutComponent,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
    FooterComponent,
    ControlDockComponent,
    AsteroidGameComponent,
    CommandPaletteComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);

  readonly gameOpen = signal(false);
  readonly paletteOpen = signal(false);
  readonly overdrive = signal(false);
  readonly toast = signal<string | null>(null);
  readonly toastLeaving = signal(false);

  readonly tickerItems = [
    'Associate Product Manager',
    'Biz2X',
    'Computer Science / AI & ML',
    'IIM Ahmedabad Research',
    'Python · SQL · PowerBI',
    'Jira · Confluence · Figma',
    'Delhi, India',
    'Press Ctrl+K',
  ];

  private konamiAt = 0;
  private toastTimer?: number;

  ngOnInit(): void {
    // First visit in this tab gets a nudge about the hidden features. Once per
    // session only — a toast on every reload would be obnoxious.
    let seen = false;
    try {
      seen = sessionStorage.getItem('ms-hinted') === '1';
    } catch {
      /* private mode — just show it */
    }
    if (!seen) {
      this.toastTimer = window.setTimeout(() => {
        this.showToast('Press Ctrl+K for commands, or G to play');
        try {
          sessionStorage.setItem('ms-hinted', '1');
        } catch {
          /* ignore */
        }
      }, 1400);
    }
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ---------------------------------------------------------------------------
  // Game
  // ---------------------------------------------------------------------------

  openGame(): void {
    this.paletteOpen.set(false);
    this.gameOpen.set(true);
    document.body.classList.add('modal-open');
  }

  closeGame(): void {
    this.gameOpen.set(false);
    document.body.classList.remove('modal-open');
  }

  // ---------------------------------------------------------------------------
  // Palette
  // ---------------------------------------------------------------------------

  openPalette(): void {
    this.paletteOpen.set(true);
    this.audio.play('click');
  }

  closePalette(): void {
    this.paletteOpen.set(false);
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  showToast(msg: string, ms = 6500): void {
    this.toastLeaving.set(false);
    this.toast.set(msg);
    window.setTimeout(() => {
      this.toastLeaving.set(true);
      window.setTimeout(() => this.toast.set(null), 320);
    }, ms);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    // Ctrl/Cmd+K opens the palette from anywhere.
    if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
      event.preventDefault();
      this.paletteOpen() ? this.closePalette() : this.openPalette();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // The game and the palette each own the keyboard while open.
    if (this.gameOpen() || this.paletteOpen()) return;

    const el = event.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;

    this.trackKonami(event.key);

    switch (event.key) {
      case 'g':
      case 'G':
        this.openGame();
        break;
      case 't':
      case 'T':
        this.showToast('Mode: ' + this.theme.cycle());
        this.audio.play('blip');
        break;
      case 'm':
      case 'M':
        this.showToast(this.audio.toggle() ? 'Sound on' : 'Sound off', 2200);
        break;
      case '/':
        event.preventDefault();
        this.openPalette();
        break;
    }
  }

  private trackKonami(key: string): void {
    // Reset if the player dawdles — stops a stray arrow keypress hours later
    // from completing the sequence.
    const now = Date.now();
    if (now - this.konamiAt > 2000) this.konamiSeq = 0;
    this.konamiAt = now;

    if (key === KONAMI[this.konamiSeq]) {
      this.konamiSeq++;
      if (this.konamiSeq === KONAMI.length) {
        this.konamiSeq = 0;
        this.toggleOverdrive();
      }
    } else {
      // Allow a wrong key to be the start of a fresh attempt.
      this.konamiSeq = key === KONAMI[0] ? 1 : 0;
    }
  }

  private konamiSeq = 0;

  private toggleOverdrive(): void {
    const on = !this.overdrive();
    this.overdrive.set(on);
    document.documentElement.classList.toggle('overdrive', on);
    this.audio.play(on ? 'levelup' : 'click');
    this.showToast(on ? 'OVERDRIVE ENGAGED' : 'Overdrive off', 3200);
  }
}
