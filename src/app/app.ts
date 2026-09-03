import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsteroidGameComponent } from './features/asteroid-game/asteroid-game';
import { CommandPaletteComponent } from './features/command-palette/command-palette';
import { ControlDockComponent } from './features/control-dock/control-dock';
import { CursorComponent } from './features/cursor/cursor';
import { ScrollProgressComponent } from './features/scroll-progress/scroll-progress';
import { StarfieldComponent } from './features/starfield/starfield';
import { SynthPadComponent } from './features/synth-pad/synth-pad';
import { FooterComponent } from './layout/footer/footer';
import { HeaderComponent } from './layout/header/header';
import { AudioService } from './services/audio.service';
import { ThemeService } from './services/theme.service';
import { UiService } from './services/ui.service';

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
    RouterOutlet,
    StarfieldComponent,
    ScrollProgressComponent,
    CursorComponent,
    HeaderComponent,
    FooterComponent,
    ControlDockComponent,
    AsteroidGameComponent,
    CommandPaletteComponent,
    SynthPadComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly ui = inject(UiService);
  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);

  private konamiSeq = 0;
  private konamiAt = 0;
  private overdrive = false;

  ngOnInit(): void {
    let seen = false;
    try {
      seen = sessionStorage.getItem('ms-hinted') === '1';
    } catch {
      /* private mode — just show it */
    }
    if (seen) return;

    window.setTimeout(() => {
      this.ui.showToast('Press Ctrl+K to explore \u{1F52E}', 6000);
      try {
        sessionStorage.setItem('ms-hinted', '1');
      } catch {
        /* ignore */
      }
    }, 1400);
  }

  /**
   * Global shortcuts. Only fire on a bare keypress, never while an overlay owns
   * the keyboard, and never while focus is in a text field.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
      event.preventDefault();
      this.ui.paletteOpen() ? this.ui.closePalette() : this.ui.openPalette();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.ui.gameOpen() || this.ui.paletteOpen() || this.ui.synthOpen()) return;

    const el = event.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;

    this.trackKonami(event.key);

    switch (event.key.toLowerCase()) {
      case 'g':
        this.ui.openGame();
        break;
      case 't':
        this.theme.cycle();
        this.ui.showToast(`${this.theme.label()} \u2014 ${this.hint()} \u{1F3A8}`, 2400);
        this.audio.play('blip');
        break;
      case 'm':
        this.ui.showToast(this.audio.toggle() ? 'Sound on \u{1F50A}' : 'Sound off \u{1F507}', 2000);
        break;
      case 'a':
        this.ui.showToast(
          this.theme.toggleAscii() ? 'ASCII mode on \u{1F4BE}' : 'ASCII mode off',
          2200,
        );
        break;
      case 'd':
        this.ui.showToast(
          this.theme.toggleDoodle() ? 'Doodle mode on \u270F\ufe0f' : 'Doodle mode off',
          2200,
        );
        break;
      case 's':
        this.ui.openSynth();
        break;
      case 'p':
        this.ui.portalHop();
        break;
      case '/':
        event.preventDefault();
        this.ui.openPalette();
        break;
    }
  }

  private hint(): string {
    return this.theme.options.find((o) => o.id === this.theme.mode())?.hint ?? '';
  }

  private trackKonami(key: string): void {
    // Reset if the player dawdles, so a stray arrow key much later can't
    // complete the sequence.
    const now = Date.now();
    if (now - this.konamiAt > 2000) this.konamiSeq = 0;
    this.konamiAt = now;

    if (key === KONAMI[this.konamiSeq]) {
      this.konamiSeq++;
      if (this.konamiSeq === KONAMI.length) {
        this.konamiSeq = 0;
        this.toggleOverdrive();
      }
      return;
    }
    this.konamiSeq = key === KONAMI[0] ? 1 : 0;
  }

  private toggleOverdrive(): void {
    this.overdrive = !this.overdrive;
    document.documentElement.classList.toggle('overdrive', this.overdrive);
    this.audio.play(this.overdrive ? 'levelup' : 'click');
    this.ui.showToast(this.overdrive ? 'OVERDRIVE ENGAGED \u26A1' : 'Overdrive off', 3200);
  }
}
