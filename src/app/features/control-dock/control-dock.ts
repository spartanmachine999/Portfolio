import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Floating control panel: live clock, theme mode, sound, and the game launcher.
 *
 * Collapses to a single button on small screens so it never sits on top of the
 * content it's meant to accompany.
 */
@Component({
  selector: 'app-control-dock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-dock.html',
  styleUrl: './control-dock.css',
})
export class ControlDockComponent implements OnInit, OnDestroy {
  readonly launchGame = output<void>();

  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);

  readonly open = signal(false);
  readonly now = signal(new Date());

  readonly mode = this.theme.mode;
  readonly soundOn = this.audio.enabled;
  readonly themeOptions = this.theme.options;

  readonly activeTheme = computed(
    () => this.themeOptions.find((o) => o.id === this.mode()) ?? this.themeOptions[0],
  );

  readonly time = computed(() =>
    this.now().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  );

  readonly day = computed(() =>
    this.now().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
  );

  private timer?: number;

  ngOnInit(): void {
    // One tick a second. Cheap, and the only thing it re-renders is the clock.
    this.timer = window.setInterval(() => this.now.set(new Date()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
    this.audio.play('click');
  }

  pickTheme(id: (typeof this.themeOptions)[number]['id']): void {
    this.theme.set(id);
    this.audio.play('blip');
  }

  toggleSound(): void {
    this.audio.toggle();
  }

  onLaunch(): void {
    this.audio.play('click');
    this.launchGame.emit();
  }
}
