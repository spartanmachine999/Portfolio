import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'ms-portfolio-sound';

type Voice = 'blip' | 'click' | 'shoot' | 'explode' | 'hit' | 'gameover' | 'levelup';

/**
 * Tiny synthesized sound engine.
 *
 * Every sound is generated with oscillators at runtime, so this costs zero
 * network requests and no audio assets ship in the bundle.
 *
 * Sound is OFF by default and the AudioContext is only created after a real
 * user gesture, which is both polite and required by browser autoplay policy.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly enabled = signal<boolean>(this.read());

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor() {
    effect(() => this.write(this.enabled()));
  }

  toggle(): boolean {
    const next = !this.enabled();
    this.enabled.set(next);
    if (next) {
      this.ensureContext();
      this.play('click');
    }
    return next;
  }

  /** Fire a named sound. No-ops silently when muted or unsupported. */
  play(voice: Voice): void {
    if (!this.enabled()) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    // Some browsers park the context until a gesture resumes it.
    if (ctx.state === 'suspended') void ctx.resume();

    switch (voice) {
      case 'blip':
        this.tone({ freq: 880, dur: 0.06, type: 'sine', gain: 0.05 });
        break;
      case 'click':
        this.tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.07 });
        this.tone({ freq: 1040, dur: 0.05, type: 'sine', gain: 0.035, delay: 0.03 });
        break;
      case 'shoot':
        this.sweep({ from: 1250, to: 380, dur: 0.11, type: 'square', gain: 0.045 });
        break;
      case 'explode':
        this.noise({ dur: 0.3, gain: 0.11, from: 1100, to: 90 });
        break;
      case 'hit':
        this.sweep({ from: 240, to: 60, dur: 0.26, type: 'sawtooth', gain: 0.1 });
        break;
      case 'levelup':
        [660, 880, 1180].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.1, type: 'triangle', gain: 0.06, delay: i * 0.08 }),
        );
        break;
      case 'gameover':
        [520, 400, 300, 180].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.22, type: 'sawtooth', gain: 0.07, delay: i * 0.13 }),
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Synthesis primitives
  // ---------------------------------------------------------------------------

  private tone(o: {
    freq: number;
    dur: number;
    type: OscillatorType;
    gain: number;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t0);

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private sweep(o: {
    from: number;
    to: number;
    dur: number;
    type: OscillatorType;
    gain: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);

    g.gain.setValueAtTime(o.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /** Filtered white noise — used for explosions. */
  private noise(o: { dur: number; gain: number; from: number; to: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * o.dur);

    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Taper the tail so it decays instead of cutting off.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + o.dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  private read(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      return false;
    }
  }

  private write(on: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }
}
