import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { MusicService } from '../../services/music.service';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';

interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  /** Extra search terms. Without these, searching "game" found nothing,
      because no visible label contains that word. */
  keywords?: string;
  run: () => void;
}

/**
 * Ctrl+K command palette.
 *
 * Doubles as the discoverability fix for everything else on the site — the
 * game, the colour modes and the sound toggle were previously only reachable
 * if you already knew they existed.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.css',
})
export class CommandPaletteComponent {
  readonly closed = output<void>();
  readonly playGame = output<void>();

  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);
  private readonly music = inject(MusicService);
  private readonly data = inject(PortfolioDataService);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');

  readonly query = signal('');
  readonly cursor = signal(0);

  private readonly commands: Command[] = [
    {
      id: 'game',
      label: 'Play Meteor Defense',
      group: 'Fun',
      hint: 'G',
      keywords: 'game arcade asteroid shooter space play fun',
      run: () => this.playGame.emit(),
    },
    {
      id: 'top',
      label: 'Go to Top',
      group: 'Navigate',
      keywords: 'home hero start intro',
      run: () => this.jump('hero'),
    },
    {
      id: 'about',
      label: 'Go to About',
      group: 'Navigate',
      keywords: 'bio who me',
      run: () => this.jump('about'),
    },
    {
      id: 'exp',
      label: 'Go to Experience',
      group: 'Navigate',
      keywords: 'work jobs career history biz2x',
      run: () => this.jump('experience'),
    },
    {
      id: 'proj',
      label: 'Go to Projects',
      group: 'Navigate',
      keywords: 'work portfolio builds finsight',
      run: () => this.jump('projects'),
    },
    {
      id: 'skills',
      label: 'Go to Skills',
      group: 'Navigate',
      keywords: 'tools tech stack python sql',
      run: () => this.jump('skills'),
    },
    {
      id: 'sound',
      label: 'Toggle UI Sound',
      group: 'Appearance',
      hint: 'M',
      keywords: 'audio mute volume sfx beep click',
      run: () => this.audio.toggle(),
    },
    {
      id: 'music',
      label: 'Play / Pause Music',
      group: 'Fun',
      keywords: 'music song track daft punk house disco beat player',
      run: () => this.music.toggle(),
    },
    {
      id: 'nexttrack',
      label: 'Next Track',
      group: 'Fun',
      keywords: 'music skip song forward',
      run: () => this.music.next(),
    },
    {
      id: 'resume',
      label: 'Download Résumé',
      group: 'Contact',
      keywords: 'cv resume pdf hire download',
      run: () => this.open(this.data.contact.resume, true),
    },
    {
      id: 'email',
      label: 'Send an Email',
      group: 'Contact',
      keywords: 'mail contact reach hire message',
      run: () => this.open('mailto:' + this.data.contact.email),
    },
    {
      id: 'linkedin',
      label: 'Open LinkedIn',
      group: 'Contact',
      keywords: 'social profile network connect',
      run: () => this.open(this.data.contact.linkedin),
    },
  ];

  /** Theme entries are generated so adding a theme needs no change here. */
  private readonly themeCommands: Command[] = this.theme.options.map((o) => ({
    id: 'theme-' + o.id,
    label: 'Theme: ' + o.label,
    group: 'Appearance',
    hint: o.hint,
    keywords: `theme colour color palette dark ${o.label} ${o.hint}`,
    run: () => this.setTheme(o.id),
  }));

  private readonly all = [...this.commands, ...this.themeCommands];

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.all;
    return this.all.filter((c) => this.matches(q, c));
  });

  constructor() {
    // Keep the highlight inside the list as it shrinks while typing.
    effect(() => {
      const max = this.filtered().length - 1;
      if (this.cursor() > max) this.cursor.set(Math.max(0, max));
    });

    // Autofocus once the overlay is in the DOM.
    effect(() => {
      const el = this.inputRef()?.nativeElement;
      if (el) setTimeout(() => el.focus(), 20);
    });
  }

  onKey(event: KeyboardEvent): void {
    const list = this.filtered();
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.cursor.set(list.length ? (this.cursor() + 1) % list.length : 0);
        this.audio.play('blip');
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.cursor.set(list.length ? (this.cursor() - 1 + list.length) % list.length : 0);
        this.audio.play('blip');
        break;
      case 'Enter':
        event.preventDefault();
        this.exec(list[this.cursor()]);
        break;
    }
  }

  exec(cmd: Command | undefined): void {
    if (!cmd) return;
    this.audio.play('click');
    cmd.run();
    // The game command opens its own overlay, so don't fight it for focus.
    if (cmd.id !== 'game') this.close();
    else this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  /**
   * Substring match across label, group and keywords; falling back to a
   * subsequence match so "gtp" still finds "Go to Projects".
   */
  private matches(q: string, c: Command): boolean {
    const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase();
    if (hay.includes(q)) return true;
    let i = 0;
    for (const ch of hay) {
      if (ch === q[i]) i++;
      if (i === q.length) return true;
    }
    return false;
  }

  private jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({
      behavior: this.theme.reducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  private setTheme(m: ThemeMode): void {
    this.theme.set(m);
  }

  private open(href: string, download = false): void {
    const a = document.createElement('a');
    a.href = href;
    if (download) a.setAttribute('download', '');
    else if (href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.click();
  }
}
