import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MusicService } from '../../services/music.service';
import { RafService } from '../../services/raf.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Music player with a live spectrum visualiser.
 *
 * The visualiser only subscribes to the frame loop while audio is actually
 * playing, so a paused player costs nothing per frame.
 */
@Component({
  selector: 'app-music-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './music-player.html',
  styleUrl: './music-player.css',
})
export class MusicPlayerComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('viz');
  private readonly raf = inject(RafService);
  private readonly theme = inject(ThemeService);
  protected readonly music = inject(MusicService);

  readonly open = signal(false);

  private ctx: CanvasRenderingContext2D | null = null;
  /** Explicitly backed by ArrayBuffer: TS 5.7 made Uint8Array generic over its
      buffer, and getByteFrequencyData won't accept a SharedArrayBuffer view. */
  private data: Uint8Array<ArrayBuffer> | null = null;
  private stop?: () => void;
  private w = 0;
  private h = 0;

  ngAfterViewInit(): void {
    this.setupCanvas();
  }

  ngOnDestroy(): void {
    this.stop?.();
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
    // The canvas is inside the collapsible panel, so it has no size until the
    // panel is actually shown.
    if (this.open()) setTimeout(() => this.setupCanvas(), 60);
  }

  togglePlay(): void {
    this.music.toggle();
    if (this.music.playing()) this.startViz();
    else this.stopViz();
  }

  onVolume(event: Event): void {
    this.music.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  }

  pick(i: number): void {
    this.music.select(i);
    if (this.music.playing()) this.startViz();
  }

  // ---------------------------------------------------------------------------
  // Visualiser
  // ---------------------------------------------------------------------------

  private setupCanvas(): void {
    const el = this.canvasRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    el.width = Math.floor(this.w * dpr);
    el.height = Math.floor(this.h * dpr);
    this.ctx = el.getContext('2d');
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startViz(): void {
    if (this.stop || this.theme.reducedMotion()) return;
    this.setupCanvas();
    this.stop = this.raf.add(() => this.drawViz());
  }

  private stopViz(): void {
    this.stop?.();
    this.stop = undefined;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  }

  private drawViz(): void {
    const analyser = this.music.getAnalyser();
    const ctx = this.ctx;
    if (!analyser || !ctx || !this.w) return;

    if (!this.data || this.data.length !== analyser.frequencyBinCount) {
      this.data = new Uint8Array(analyser.frequencyBinCount);
    }
    analyser.getByteFrequencyData(this.data);

    ctx.clearRect(0, 0, this.w, this.h);

    const bars = 28;
    const gap = 2;
    const bw = (this.w - gap * (bars - 1)) / bars;
    const accent = this.theme.accentRgb();

    for (let i = 0; i < bars; i++) {
      // Skip the very lowest bins; they dominate and flatten everything else.
      const bin = 2 + Math.floor((i / bars) * (this.data.length - 6));
      const v = this.data[bin] / 255;
      const bh = Math.max(2, v * this.h);
      const x = i * (bw + gap);
      const y = this.h - bh;

      ctx.fillStyle = `rgba(${accent}, ${(0.35 + v * 0.65).toFixed(2)})`;
      ctx.fillRect(x, y, bw, bh);
    }
  }
}
