import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { ThemeService } from '../../services/theme.service';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: 'red' | 'cyan' | 'magenta';
}

interface Shock {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

/**
 * Spawns a burst of sparks and an expanding shockwave ring wherever you click.
 *
 * The render loop is demand-driven: it starts on the first click and shuts
 * itself down the moment the last particle dies. An always-on rAF for an effect
 * that fires a few times a minute would waste battery for nothing.
 */
@Component({
  selector: 'app-click-fx',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 150;
        pointer-events: none;
        display: block;
      }

      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class ClickFxComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);

  private ctx: CanvasRenderingContext2D | null = null;
  private sparks: Spark[] = [];
  private shocks: Shock[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private readonly onResize = () => this.resize();

  private readonly onDown = (e: PointerEvent) => {
    if (this.theme.reducedMotion()) return;
    this.burst(e.clientX, e.clientY);
    this.ensureRunning();
  };

  ngAfterViewInit(): void {
    const c = this.canvasRef().nativeElement;
    this.ctx = c.getContext('2d');
    if (!this.ctx) return;

    this.resize();
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointerdown', this.onDown, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('resize', this.onResize);
  }

  private resize(): void {
    const c = this.canvasRef().nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    c.width = Math.floor(this.w * this.dpr);
    c.height = Math.floor(this.h * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private burst(x: number, y: number): void {
    const hues: Spark['hue'][] = ['red', 'red', 'red', 'cyan', 'magenta'];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const s = 90 + Math.random() * 230;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 0.32 + Math.random() * 0.42,
        size: 1 + Math.random() * 2.4,
        hue: hues[(Math.random() * hues.length) | 0],
      });
    }
    this.shocks.push({ x, y, life: 0, maxLife: 0.45 });
  }

  private ensureRunning(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= 0.96;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      const a = 1 - p.life / p.maxLife;
      ctx.fillStyle =
        p.hue === 'cyan'
          ? `rgba(0, 234, 255, ${a})`
          : p.hue === 'magenta'
            ? `rgba(255, 0, 128, ${a})`
            : `rgba(255, ${(90 + a * 130) | 0}, ${(90 + a * 60) | 0}, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.shocks.splice(i, 1);
        continue;
      }
      const t = s.life / s.maxLife;
      const r = 6 + t * 58;
      ctx.strokeStyle = `rgba(255, 60, 60, ${(1 - t) * 0.75})`;
      ctx.lineWidth = 2 * (1 - t) + 0.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Nothing left to draw: stop the loop instead of spinning on empty frames.
    if (!this.sparks.length && !this.shocks.length) {
      ctx.clearRect(0, 0, this.w, this.h);
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
}
