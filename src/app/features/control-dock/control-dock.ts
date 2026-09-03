import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { UiService } from '../../services/ui.service';
import { WeatherService } from '../../services/weather.service';

interface Zone {
  label: string;
  tz: string;
  flag: string;
}

/**
 * Floating control panel: clock, world clocks, weather, theme, skins and toys.
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
  private readonly theme = inject(ThemeService);
  private readonly audio = inject(AudioService);
  protected readonly ui = inject(UiService);
  protected readonly weather = inject(WeatherService);

  readonly open = signal(false);
  readonly now = signal(new Date());

  readonly mode = this.theme.mode;
  readonly ascii = this.theme.ascii;
  readonly doodle = this.theme.doodle;
  readonly soundOn = this.audio.enabled;
  readonly themeOptions = this.theme.options;

  readonly zones: readonly Zone[] = [
    { label: 'Delhi', tz: 'Asia/Kolkata', flag: '\u{1F1EE}\u{1F1F3}' },
    { label: 'London', tz: 'Europe/London', flag: '\u{1F1EC}\u{1F1E7}' },
    { label: 'New York', tz: 'America/New_York', flag: '\u{1F1FA}\u{1F1F8}' },
    { label: 'Tokyo', tz: 'Asia/Tokyo', flag: '\u{1F1EF}\u{1F1F5}' },
  ];

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

  /** Recomputes with `now`, so all four clocks tick together. */
  readonly worldTimes = computed(() => {
    const d = this.now();
    return this.zones.map((z) => ({
      ...z,
      time: d.toLocaleTimeString('en-GB', {
        timeZone: z.tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    }));
  });

  private timer?: number;

  ngOnInit(): void {
    // One tick a second. The only thing it re-renders is the clock block.
    this.timer = window.setInterval(() => this.now.set(new Date()), 1000);
    this.weather.load();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
    this.audio.play('click');
  }

  pickTheme(id: ThemeMode): void {
    this.theme.set(id);
    this.audio.play('blip');
  }

  toggleSound(): void {
    this.audio.toggle();
  }

  toggleAscii(): void {
    this.theme.toggleAscii();
    this.audio.play('blip');
  }

  toggleDoodle(): void {
    this.theme.toggleDoodle();
    this.audio.play('blip');
  }
}
