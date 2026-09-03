import { Injectable, signal } from '@angular/core';

export type WeatherState = 'idle' | 'locating' | 'loading' | 'ready' | 'denied' | 'failed';

export interface Weather {
  temp: number;
  label: string;
  icon: string;
  place: string;
}

/** Shown when the visitor won't share their location. */
const DENIED_LINES = [
  "No location perms, so no idea where you are \u2014 but I hope it's sunny \u2600\ufe0f",
  "Location's a secret, fair enough. Assuming perfect weather \u{1F324}\ufe0f",
  "Can't see where you are, so let's pretend it's 24\u00b0C and lovely \u{1F60E}",
];

/**
 * Weather for wherever the visitor actually is.
 *
 * Deliberately does NOT ask on page load. A permission prompt firing before
 * anyone has interacted is hostile, and browsers increasingly ignore it anyway.
 * `request()` is called the first time the dock panel is opened, which is both a
 * real user gesture and the moment the widget becomes visible.
 *
 * Open-Meteo needs no API key, so there's no secret to leak and nothing to
 * maintain. Reverse geocoding is best-effort: if it fails, the reading still
 * shows, just without a place name.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  readonly state = signal<WeatherState>('idle');
  readonly data = signal<Weather | null>(null);
  readonly deniedLine = signal(DENIED_LINES[0]);

  private asked = false;

  /** Safe to call repeatedly; only the first call does anything. */
  request(): void {
    if (this.asked) return;
    this.asked = true;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.deny();
      return;
    }

    this.state.set('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.state.set('loading');
        void this.load(pos.coords.latitude, pos.coords.longitude);
      },
      () => this.deny(),
      { timeout: 9000, maximumAge: 900_000, enableHighAccuracy: false },
    );
  }

  private deny(): void {
    this.deniedLine.set(DENIED_LINES[Math.floor(Math.random() * DENIED_LINES.length)]);
    this.state.set('denied');
  }

  private async load(lat: number, lon: number): Promise<void> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}` +
        `&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`;

      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error(String(res.status));

      const json = await res.json();
      const c = json?.current;
      if (!c) throw new Error('no current block');

      const code = Number(c.weather_code);
      const isDay = Number(c.is_day) === 1;

      this.data.set({
        temp: Math.round(Number(c.temperature_2m)),
        label: describe(code),
        icon: iconFor(code, isDay),
        place: await this.placeName(lat, lon),
      });
      this.state.set('ready');
    } catch {
      this.state.set('failed');
    }
  }

  /** Best-effort city name. Never throws; degrades to a vague phrase. */
  private async placeName(lat: number, lon: number): Promise<string> {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client` +
          `?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&localityLanguage=en`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return 'your area';
      const j = await res.json();
      return j?.city || j?.locality || j?.principalSubdivision || j?.countryName || 'your area';
    } catch {
      return 'your area';
    }
  }
}

/** WMO weather interpretation codes, collapsed to readable buckets. */
function describe(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

function iconFor(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? '\u2600\ufe0f' : '\u{1F319}';
  if (code <= 2) return isDay ? '\u26c5' : '\u2601\ufe0f';
  if (code === 3) return '\u2601\ufe0f';
  if (code <= 48) return '\u{1F32B}\ufe0f';
  if (code <= 67) return '\u{1F327}\ufe0f';
  if (code <= 77) return '\u2744\ufe0f';
  if (code <= 86) return '\u{1F326}\ufe0f';
  return '\u26c8\ufe0f';
}
