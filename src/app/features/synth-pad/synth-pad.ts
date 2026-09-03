import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  output,
  signal,
} from '@angular/core';

interface Pad {
  key: string;
  note: string;
  freq: number;
}

/** A4 = 440. Two octaves of a pentatonic-ish scale, so any combination sounds fine. */
const PADS: Pad[] = [
  { key: 'a', note: 'C', freq: 261.63 },
  { key: 's', note: 'D', freq: 293.66 },
  { key: 'd', note: 'E', freq: 329.63 },
  { key: 'f', note: 'G', freq: 392.0 },
  { key: 'g', note: 'A', freq: 440.0 },
  { key: 'h', note: 'C\u2082', freq: 523.25 },
  { key: 'j', note: 'D\u2082', freq: 587.33 },
  { key: 'k', note: 'E\u2082', freq: 659.25 },
  { key: 'l', note: 'G\u2082', freq: 783.99 },
];

type Voice = 'keys' | 'pluck' | 'bell';

/**
 * Playable pad grid.
 *
 * Deliberately a toy rather than background music: it makes no sound until you
 * hit something. Notes are a pentatonic scale, so there is no combination of
 * pads that sounds wrong — which matters when the point is mashing keys.
 *
 * Each voice is built from oscillators plus a feedback-delay tail. The delay is
 * what stops it sounding like a bare test tone.
 */
@Component({
  selector: 'app-synth-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './synth-pad.html',
  styleUrl: './synth-pad.css',
})
export class SynthPadComponent implements OnDestroy {
  readonly closed = output<void>();

  readonly pads = PADS;
  readonly voice = signal<Voice>('keys');
  readonly active = signal<ReadonlySet<string>>(new Set());
  readonly voices: Voice[] = ['keys', 'pluck', 'bell'];

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private delay: DelayNode | null = null;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Escape') {
      this.closed.emit();
      return;
    }

    const pad = PADS.find((p) => p.key === e.key.toLowerCase());
    if (!pad) return;
    e.preventDefault();
    this.hit(pad);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const pad = PADS.find((p) => p.key === e.key.toLowerCase());
    if (pad) this.release(pad.key);
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    void this.ctx?.close();
  }

  close(): void {
    this.closed.emit();
  }

  setVoice(v: Voice): void {
    this.voice.set(v);
  }

  hit(pad: Pad): void {
    this.active.update((s) => new Set(s).add(pad.key));
    this.play(pad.freq);
    // Purely visual release; the audio envelope decays on its own.
    window.setTimeout(() => this.release(pad.key), 220);
  }

  private release(key: string): void {
    this.active.update((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.5;

      // Feedback delay gives every note a tail so it sounds like an instrument
      // in a space rather than a raw oscillator.
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.26;

      const fb = ctx.createGain();
      fb.gain.value = 0.32;

      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2200;

      this.delay.connect(damp);
      damp.connect(fb);
      fb.connect(this.delay);

      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      this.delay.connect(wet);

      this.master.connect(ctx.destination);
      wet.connect(ctx.destination);

      return ctx;
    } catch {
      return null;
    }
  }

  private play(freq: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.delay) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t0 = ctx.currentTime;
    const v = this.voice();

    const shape: OscillatorType = v === 'keys' ? 'triangle' : v === 'pluck' ? 'sawtooth' : 'sine';
    const dur = v === 'bell' ? 1.9 : v === 'pluck' ? 0.5 : 1.1;
    const peak = v === 'bell' ? 0.16 : 0.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (v === 'pluck' ? 0.004 : 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 8, t0);
    lp.frequency.exponentialRampToValueAtTime(freq * 2, t0 + dur);
    lp.Q.value = 1.4;

    // Two detuned oscillators, plus a bell partial for the bell voice.
    for (const cents of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = shape;
      o.frequency.value = freq * Math.pow(2, cents / 1200);
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }

    if (v === 'bell') {
      const o = ctx.createOscillator();
      const bg = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * 2.76; // inharmonic partial, reads as metallic
      bg.gain.setValueAtTime(0.05, t0);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.7);
      o.connect(bg).connect(lp);
      o.start(t0);
      o.stop(t0 + dur);
    }

    lp.connect(g);
    g.connect(this.master);
    g.connect(this.delay);
  }
}
