import { Injectable, OnDestroy, signal } from '@angular/core';

export interface Track {
  name: string;
  vibe: string;
  bpm: number;
  /** Chord roots as semitone offsets from A2, one per bar. */
  progression: number[];
  /** Chord shape in semitones above the root. */
  shape: number[];
  /** 16-step bass gate. 1 = play root, 2 = play octave. */
  bass: number[];
  /** 16-step chord-stab gate. */
  stabs: number[];
  /** Lead melody as semitone offsets above the bar root; null = rest. */
  lead: (number | null)[];
  swing: number;
}

const A2 = 110;
const semi = (n: number) => A2 * Math.pow(2, n / 12);

/**
 * French-house / nu-disco loop engine, in the spirit of Daft Punk.
 *
 * These are ORIGINAL compositions, not covers or samples. Every sound is
 * synthesized from oscillators and noise buffers at runtime, so no audio files
 * ship and no third-party licensing is involved.
 *
 * Scheduling uses the standard lookahead pattern: a timer wakes up regularly and
 * schedules any notes falling inside the next window directly on the audio
 * clock. Triggering notes straight off a JS timer would drift audibly, because
 * setInterval is not sample-accurate.
 */
@Injectable({ providedIn: 'root' })
export class MusicService implements OnDestroy {
  readonly tracks: readonly Track[] = [
    {
      name: 'Nightdrive',
      vibe: 'Filtered house · 118bpm',
      bpm: 118,
      progression: [0, -2, -5, -3],
      shape: [0, 3, 7, 10],
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      stabs: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      lead: [12, null, 15, 14, null, 12, null, 10, null, 7, null, 10, 12, null, null, null],
      swing: 0.02,
    },
    {
      name: 'Silicon Heart',
      vibe: 'Vocoder disco · 124bpm',
      bpm: 124,
      progression: [-3, -3, 0, -5],
      shape: [0, 4, 7, 11],
      bass: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0],
      stabs: [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
      lead: [7, 11, 12, null, 11, 7, null, 4, 7, null, 12, 14, null, 12, null, null],
      swing: 0.035,
    },
    {
      name: 'Neon Circuit',
      vibe: 'Peak-time arp · 128bpm',
      bpm: 128,
      progression: [0, 5, 3, -2],
      shape: [0, 3, 7, 14],
      bass: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
      stabs: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
      lead: [0, 7, 12, 7, 15, 7, 12, 7, 3, 10, 15, 10, 12, 7, 3, null],
      swing: 0,
    },
    {
      name: 'Afterburner',
      vibe: 'Slow burn · 112bpm',
      bpm: 112,
      progression: [-5, -7, -3, -5],
      shape: [0, 3, 7, 12],
      bass: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      stabs: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
      lead: [null, null, 12, 10, 7, null, null, 5, 7, null, 10, null, 12, null, null, null],
      swing: 0.045,
    },
  ];

  readonly playing = signal(false);
  readonly index = signal(0);
  readonly volume = signal(0.55);
  readonly current = signal<Track>(this.tracks[0]);
  readonly bar = signal(0);

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private step = 0;
  private nextTime = 0;
  private timer?: number;

  ngOnDestroy(): void {
    this.stop();
    void this.ctx?.close();
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  toggle(): void {
    this.playing() ? this.stop() : this.play();
  }

  play(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.playing.set(true);

    // 25ms wake-up, 120ms scheduling horizon.
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.playing.set(false);

    // Short fade instead of a hard cut, which would click.
    const ctx = this.ctx;
    if (ctx && this.master) {
      const g = this.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      window.setTimeout(() => {
        if (!this.playing() && this.master && this.ctx) {
          this.master.gain.setValueAtTime(this.volume(), this.ctx.currentTime);
        }
      }, 140);
    }
  }

  next(): void {
    this.select((this.index() + 1) % this.tracks.length);
  }

  prev(): void {
    this.select((this.index() - 1 + this.tracks.length) % this.tracks.length);
  }

  select(i: number): void {
    const was = this.playing();
    if (was) this.stop();
    this.index.set(i);
    this.current.set(this.tracks[i]);
    if (was) window.setTimeout(() => this.play(), 160);
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.volume.set(clamped);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  // ---------------------------------------------------------------------------
  // Graph
  // ---------------------------------------------------------------------------

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.volume();

      // Everything melodic runs through `duck` so the kick can sidechain it —
      // that pumping is the signature of the genre.
      this.duck = ctx.createGain();
      this.duck.gain.value = 1;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.75;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3.4;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;

      this.duck.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      // One second of white noise, reused for every percussion hit.
      const frames = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;

      return ctx;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Sequencer
  // ---------------------------------------------------------------------------

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing()) return;

    const t = this.current();
    const stepDur = 60 / t.bpm / 4;

    while (this.nextTime < ctx.currentTime + 0.12) {
      const s = this.step % 16;
      const barIndex = Math.floor(this.step / 16) % t.progression.length;
      const cycle = Math.floor(this.step / 16);

      // Swing pushes odd 16ths slightly late.
      const when = this.nextTime + (s % 2 === 1 ? t.swing * stepDur : 0);

      this.renderStep(t, s, barIndex, cycle, when, stepDur);

      if (s === 0) {
        const b = cycle;
        queueMicrotask(() => this.bar.set(b));
      }

      this.step++;
      this.nextTime += stepDur;
    }
  }

  private renderStep(
    t: Track,
    s: number,
    barIndex: number,
    cycle: number,
    when: number,
    stepDur: number,
  ): void {
    const root = t.progression[barIndex];

    // --- Kick on every quarter, with sidechain duck ---
    if (s % 4 === 0) {
      this.kick(when);
      this.pump(when);
    }

    // --- Clap on the backbeat ---
    if (s === 4 || s === 12) this.clap(when);

    // --- Hats on offbeat 8ths, open every fourth ---
    if (s % 2 === 1) this.hat(when, s === 2 || s === 10 ? 0.05 : 0.028);

    // --- Bass ---
    const bassGate = t.bass[s];
    if (bassGate) {
      this.bass(semi(root + (bassGate === 2 ? 12 : 0)), when, stepDur * 1.7);
    }

    // --- Chord stabs ---
    if (t.stabs[s]) {
      // Filter opens up over an 8-bar cycle for the classic build.
      const openness = 0.45 + 0.55 * (((cycle % 8) + 1) / 8);
      this.stab(root, t.shape, when, stepDur * 1.4, openness);
    }

    // --- Lead ---
    const note = t.lead[s];
    if (note !== null && note !== undefined && cycle % 4 >= 1) {
      this.lead(semi(root + note), when, stepDur * 1.25);
    }
  }

  // ---------------------------------------------------------------------------
  // Voices
  // ---------------------------------------------------------------------------

  /** Sidechain: dip the melodic bus on each kick. */
  private pump(when: number): void {
    const g = this.duck?.gain;
    if (!g) return;
    g.cancelScheduledValues(when);
    g.setValueAtTime(1, when);
    g.linearRampToValueAtTime(0.42, when + 0.012);
    g.linearRampToValueAtTime(1, when + 0.17);
  }

  private kick(when: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.11);

    g.gain.setValueAtTime(0.9, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.26);

    // Click transient so it cuts through on small speakers.
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(900, when);
    cg.gain.setValueAtTime(0.16, when);
    cg.gain.exponentialRampToValueAtTime(0.0001, when + 0.02);

    osc.connect(g).connect(this.master);
    click.connect(cg).connect(this.master);
    osc.start(when);
    osc.stop(when + 0.3);
    click.start(when);
    click.stop(when + 0.04);
  }

  private clap(when: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.duck) return;

    // Three tight bursts read as a clap rather than a snare.
    for (let i = 0; i < 3; i++) {
      const t0 = when + i * 0.011;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 1.4;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1750;
      bp.Q.value = 1.1;

      const g = ctx.createGain();
      g.gain.setValueAtTime(i === 2 ? 0.3 : 0.16, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === 2 ? 0.14 : 0.045));

      src.connect(bp).connect(g).connect(this.duck);
      src.start(t0, Math.random() * 0.4);
      src.stop(t0 + 0.2);
    }
  }

  private hat(when: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.duck) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 2.4;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 8200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.075, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    src.connect(hp).connect(g).connect(this.duck);
    src.start(when, Math.random() * 0.4);
    src.stop(when + dur + 0.03);
  }

  private bass(freq: number, when: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    sub.type = 'sine';
    sub.frequency.value = freq / 2;

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 7, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 2.4), when + dur);
    lp.Q.value = 5;

    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.3, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.master);
    osc.start(when);
    sub.start(when);
    osc.stop(when + dur + 0.05);
    sub.stop(when + dur + 0.05);
  }

  /** Stacked detuned saws through a resonant lowpass — the house chord stab. */
  private stab(root: number, shape: number[], when: number, dur: number, openness: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.duck) return;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600 + 5200 * openness, when);
    lp.frequency.exponentialRampToValueAtTime(400 + 900 * openness, when + dur);
    lp.Q.value = 7;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.11, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    lp.connect(g).connect(this.duck);

    for (const iv of shape) {
      const f = semi(root + iv + 12);
      // Two slightly detuned saws per note for width.
      for (const cents of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * Math.pow(2, cents / 1200);
        o.connect(lp);
        o.start(when);
        o.stop(when + dur + 0.05);
      }
    }
  }

  private lead(freq: number, when: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.duck) return;

    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = freq * 2;

    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 9, when);
    lp.frequency.exponentialRampToValueAtTime(freq * 3, when + dur);
    lp.Q.value = 3.5;

    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.062, when + 0.012);
    g.gain.setValueAtTime(0.062, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(lp).connect(g).connect(this.duck);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }
}
