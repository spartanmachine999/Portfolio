import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ThemeService } from '../../services/theme.service';

interface Star {
  x: number;
  y: number;
  depth: number;
  r: number;
  alpha: number;
  twinkleRate: number;
  phase: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  width: number;
  life: number;
  maxLife: number;
  fireball: boolean;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * The animated background: a parallax starfield with a meteor shower over it.
 *
 * Replaces the original implementation, which appended a new `<div>` to the
 * DOM every 300ms forever via setInterval. That approach never stopped, never
 * cleaned up, and thrashed layout. This draws everything to a single canvas.
 *
 * Notes on the things that matter here:
 *  - The render loop runs OUTSIDE the Angular zone. If it didn't, every frame
 *    would trigger change detection and the whole app would re-render 60x/sec.
 *  - Rendering pauses when the tab is hidden, so it stops burning battery in
 *    a background tab.
 *  - Meteors radiate from one off-screen point, which is what real showers do
 *    and reads far better than independent random streaks.
 *  - Density follows the theme mode; `void` switches meteors off completely,
 *    as does the OS reduced-motion setting.
 */
@Component({
  selector: 'app-starfield',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: -1;
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
export class StarfieldComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private running = false;

  private w = 0;
  private h = 0;
  private dpr = 1;

  private stars: Star[] = [];
  private meteors: Meteor[] = [];
  private embers: Ember[] = [];

  private scrollY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private targetPX = 0;
  private targetPY = 0;

  private lastFrame = 0;
  private spawnAccumulator = 0;

  /** Meteors originate from here (just off the top-right corner). */
  private radiantX = 0;
  private radiantY = 0;

  private readonly onResize = () => this.resize();
  private readonly onScroll = () => {
    this.scrollY = window.scrollY || 0;
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    this.targetPX = e.clientX;
    this.targetPY = e.clientY;
  };
  private readonly onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  constructor() {
    // React to theme changes: void mode clears the sky, others repopulate it.
    effect(() => {
      const density = this.theme.meteorDensity();
      if (density === 0) {
        this.meteors = [];
        this.embers = [];
      }
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) return;

    this.resize();

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);

    if (this.theme.reducedMotion()) {
      // Draw one static frame so the sky is still there, just still.
      this.drawStatic();
      return;
    }

    this.start();
  }

  ngOnDestroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  // ---------------------------------------------------------------------------
  // Loop control
  // ---------------------------------------------------------------------------

  private start(): void {
    if (this.running || this.theme.reducedMotion() || !this.ctx) return;
    this.running = true;
    this.lastFrame = performance.now();
    // Critical: keep the frame loop out of Angular's zone.
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });
  }

  private stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ---------------------------------------------------------------------------
  // Sizing
  // ---------------------------------------------------------------------------

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    // Cap DPR at 2 — beyond that the pixel cost buys almost nothing visually.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;

    canvas.width = Math.floor(this.w * this.dpr);
    canvas.height = Math.floor(this.h * this.dpr);

    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.radiantX = this.w * 1.05;
    this.radiantY = -this.h * 0.15;

    this.seedStars();
    if (this.theme.reducedMotion()) this.drawStatic();
  }

  private seedStars(): void {
    // Scale with viewport area, but keep phones light.
    const area = this.w * this.h;
    const count = Math.round(Math.min(280, Math.max(60, area / 7800)));

    this.stars = Array.from({ length: count }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        depth,
        r: 0.4 + depth * 1.5,
        alpha: 0.22 + Math.random() * 0.6,
        twinkleRate: 0.4 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  private frame(now: number): void {
    if (!this.running || !this.ctx) return;

    // Clamp dt so a backgrounded tab doesn't produce one giant jump.
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    this.update(dt, now);
    this.render(now);

    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number, now: number): void {
    // Ease the parallax pointer toward the real cursor.
    this.pointerX += (this.targetPX - this.pointerX) * Math.min(1, dt * 3.5);
    this.pointerY += (this.targetPY - this.pointerY) * Math.min(1, dt * 3.5);

    const density = this.theme.meteorDensity();

    if (density > 0) {
      // Roughly one meteor every 0.55s at full density.
      this.spawnAccumulator += dt * density;
      const interval = 0.55;
      while (this.spawnAccumulator >= interval) {
        this.spawnAccumulator -= interval;
        this.spawnMeteor();
      }
    }

    // Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life += dt;

      if (m.fireball && Math.random() < 0.55) this.spawnEmber(m);

      const off = m.x < -400 || m.y > this.h + 400 || m.life > m.maxLife;
      if (off) this.meteors.splice(i, 1);
    }

    // Embers
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 14 * dt; // gentle gravity
      e.vx *= 0.98;
      e.life += dt;
      if (e.life >= e.maxLife) this.embers.splice(i, 1);
    }

    // Twinkle
    for (const s of this.stars) {
      s.phase += s.twinkleRate * dt;
    }

    void now;
  }

  private spawnMeteor(): void {
    // Fan out from the radiant, heading down-left.
    const spread = 0.5;
    const angle = Math.PI * 0.78 + (Math.random() - 0.5) * spread;
    const fireball = Math.random() < 0.12;
    const speed = (fireball ? 320 : 460) + Math.random() * 320;

    // Start somewhere along a line sweeping across the top / right edges.
    const t = Math.random();
    const startX = this.radiantX - t * this.w * 1.5;
    const startY = this.radiantY + t * this.h * 0.55 + Math.random() * this.h * 0.3;

    this.meteors.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed,
      len: fireball ? 150 + Math.random() * 130 : 70 + Math.random() * 110,
      width: fireball ? 2.6 + Math.random() * 1.6 : 1 + Math.random() * 1.2,
      life: 0,
      maxLife: 4,
      fireball,
    });
  }

  private spawnEmber(m: Meteor): void {
    if (this.embers.length > 140) return;
    this.embers.push({
      x: m.x,
      y: m.y,
      vx: (Math.random() - 0.5) * 60 - m.vx * 0.04,
      vy: (Math.random() - 0.5) * 60 - m.vy * 0.04,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.7,
      size: 0.7 + Math.random() * 1.5,
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.w, this.h);

    this.drawStars(ctx, now);
    this.drawMeteors(ctx);
    this.drawEmbers(ctx);
  }

  private drawStars(ctx: CanvasRenderingContext2D, now: number): void {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const px = (this.pointerX - cx) || 0;
    const py = (this.pointerY - cy) || 0;

    for (const s of this.stars) {
      // Deeper stars move less — that difference is what sells the depth.
      const par = 0.25 + s.depth * 0.75;
      const ox = -px * 0.012 * par;
      const oy = -py * 0.012 * par - this.scrollY * 0.06 * par;

      let y = (s.y + oy) % this.h;
      if (y < 0) y += this.h;
      let x = (s.x + ox) % this.w;
      if (x < 0) x += this.w;

      const tw = 0.65 + 0.35 * Math.sin(s.phase);
      const a = s.alpha * tw;

      // Warm the brighter stars toward the red identity.
      ctx.fillStyle =
        s.depth > 0.72
          ? `rgba(255, ${Math.round(190 - s.depth * 55)}, ${Math.round(185 - s.depth * 60)}, ${a.toFixed(3)})`
          : `rgba(255, 246, 246, ${(a * 0.8).toFixed(3)})`;

      if (s.r <= 0.9) {
        // fillRect is measurably cheaper than arc() for sub-pixel dots.
        ctx.fillRect(x, y, s.r * 2, s.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    void now;
  }

  private drawMeteors(ctx: CanvasRenderingContext2D): void {
    for (const m of this.meteors) {
      const speed = Math.hypot(m.vx, m.vy) || 1;
      const tailX = m.x - (m.vx / speed) * m.len;
      const tailY = m.y - (m.vy / speed) * m.len;

      // Fade in fast, fade out over the tail of its life.
      const fade = Math.min(1, m.life * 6) * Math.max(0, 1 - m.life / m.maxLife);

      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      if (m.fireball) {
        grad.addColorStop(0, `rgba(255, 246, 232, ${0.95 * fade})`);
        grad.addColorStop(0.18, `rgba(255, 168, 96, ${0.8 * fade})`);
        grad.addColorStop(0.55, `rgba(255, 60, 60, ${0.34 * fade})`);
      } else {
        grad.addColorStop(0, `rgba(255, 238, 238, ${0.92 * fade})`);
        grad.addColorStop(0.3, `rgba(255, 90, 90, ${0.5 * fade})`);
      }
      grad.addColorStop(1, 'rgba(255, 60, 60, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Hot head.
      const headR = m.width * (m.fireball ? 2.4 : 1.5);
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, headR * 4);
      hg.addColorStop(0, `rgba(255, 250, 244, ${0.95 * fade})`);
      hg.addColorStop(0.4, `rgba(255, ${m.fireball ? 150 : 90}, 80, ${0.42 * fade})`);
      hg.addColorStop(1, 'rgba(255, 60, 60, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, headR * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEmbers(ctx: CanvasRenderingContext2D): void {
    for (const e of this.embers) {
      const a = Math.max(0, 1 - e.life / e.maxLife);
      ctx.fillStyle = `rgba(255, ${Math.round(140 + a * 90)}, 90, ${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A single still frame for reduced-motion visitors. */
  private drawStatic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawStars(ctx, 0);
  }
}
