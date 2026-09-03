import { Injectable, signal } from '@angular/core';

export interface Weather {
  temp: number;
  code: number;
  label: string;
  icon: string;
  isDay: boolean;
}

/** Delhi. Hardcoded because it's the only place this widget cares about. */
const LAT = 28.6139;
const LON = 77.209;

/**
 * Live weather from Open-Meteo.
 *
 * Chosen specifically because it needs no API key and no signup, so there's no
 * secret to leak and nothing for the site owner to maintain. Free for
 * non-commercial use.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  readonly data = signal<Weather | null>(null);
  readonly failed = signal(false);

  private fetched = false;

  /** Safe to call repeatedly; only the first call hits the network. */
  load(): void {
    if (this.fetched) return;
    this.fetched = true;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,weather_code,is_day&timezone=Asia%2FKolkata`;

    fetch(url, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const c = j?.current;
        if (!c) throw new Error('no current block');
        const code = Number(c.weather_code);
        const isDay = Number(c.is_day) === 1;
        this.data.set({
          temp: Math.round(Number(c.temperature_2m)),
          code,
          isDay,
          label: describe(code),
          icon: iconFor(code, isDay),
        });
      })
      .catch(() => {
        // Widget just hides itself rather than showing a broken state.
        this.failed.set(true);
      });
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
