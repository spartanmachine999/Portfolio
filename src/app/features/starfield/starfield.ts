import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { RafService } from '../../services/raf.service';
import { ThemeService } from '../../services/theme.service';

/** Decorative background star. Parallax + twinkle only, no physics. */
interface Star {
  x: number;
  y: number;
  depth: number;
  r: number;
  alpha: number;
  rate: number;
  phase: number;
}

/** Constellation node. Drifts, reacts to the cursor and to shockwaves. */
interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
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

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Shock {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  r: number;
}

const ALPHA_BUCKETS = 6;

/**
 * The interactive background: parallax starfield, cursor-reactive constellation
 * network, meteor shower, and click shockwaves.
 *
 * This is deliberately ONE canvas driven by ONE shared frame loop. It previously
 * shared the screen with a second full-page canvas for click effects and a third
 * rAF for the cursor; consolidating removed two composited layers and two
 * independent loops, which is most of the smoothness win.
 *
 * Performance notes, since this runs every frame:
 *  - Stars are drawn in alpha buckets. Instead of one fillStyle write and one
 *    path per star (280 state changes), stars are grouped into 6 opacity bands
 *    and each band is a single path. Roughly 12 draw calls total.
 *  - Distance tests compare squared values; no sqrt in the hot loop.
 *  - The constellation network runs over a small node population (~90) rather
 *    than every star, keeping the O(n^2) link search cheap.
 *  - Quality follows RafService, so slow devices shed particles automatically
 *    rather than dropping frames.
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
  private readonly raf = inject(RafService);
  private readonly theme = inject(ThemeService);

  private ctx: CanvasRenderingContext2D | null = null;
  private stop?: () => void;

  private w = 0;
  private h = 0;
  private dpr = 1;

  private stars: Star[] = [];
  private nodes: Node[] = [];
  private meteors: Meteor[] = [];
  private sparks: Spark[] = [];
  private shocks: Shock[] = [];

  private scrollY = 0;
  private mx = -9999;
  private my = -9999;
  private tmx = -9999;
  private tmy = -9999;
  private pointerInside = false;

  private spawnAcc = 0;
  private radiantX = 0;
  private radiantY = 0;

  private readonly onResize = () => this.resize();
  private readonly onScroll = () => {
    this.scrollY = window.scrollY || 0;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    this.tmx = e.clientX;
    this.tmy = e.clientY;
    this.pointerInside = true;
  };

  private readonly onPointerLeave = () => {
    this.pointerInside = false;
    this.tmx = -9999;
    this.tmy = -9999;
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    this.shock(e.clientX, e.clientY);
  };

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) return;

    this.resize();

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    document.addEventListener('pointerleave', this.onPointerLeave);

    if (this.theme.reducedMotion()) {
      this.render(0);
      return;
    }

    this.stop = this.raf.add((dt) => {
      this.update(dt);
      this.render(dt);
    });
  }

  ngOnDestroy(): void {
    this.stop?.();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('pointerleave', this.onPointerLeave);
  }

  // ---------------------------------------------------------------------------
  // Sizing / seeding
  // ---------------------------------------------------------------------------

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    // Capping DPR at 2 costs almost nothing visually and saves a lot of fill.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;

    canvas.width = Math.floor(this.w * this.dpr);
    canvas.height = Math.floor(this.h * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.radiantX = this.w * 1.05;
    this.radiantY = -this.h * 0.15;

    this.seed();
    if (this.theme.reducedMotion()) this.render(0);
  }

  private seed(): void {
    const q = this.raf.quality();
    const area = this.w * this.h;

    const starCount = Math.round(Math.min(300, Math.max(50, area / 7200)) * q);
    this.stars = Array.from({ length: starCount }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        depth,
        r: 0.4 + depth * 1.4,
        alpha: 0.2 + Math.random() * 0.62,
        rate: 0.4 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2,
      };
    });

    // Node count is what drives the O(n^2) link search, so keep it modest and
    // scale it down hard on small screens.
    const nodeCount = Math.round(Math.min(95, Math.max(22, area / 20000)) * q);
    this.nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16,
      r: 1 + Math.random() * 1.6,
    }));
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private update(dt: number): void {
    // Ease the tracked pointer so the network reacts smoothly, not jitterily.
    if (this.pointerInside) {
      this.mx += (this.tmx - this.mx) * Math.min(1, dt * 9);
      this.my += (this.tmy - this.my) * Math.min(1, dt * 9);
    } else {
      this.mx = -9999;
      this.my = -9999;
    }

    this.updateNodes(dt);
    this.updateMeteors(dt);
    this.updateSparks(dt);
    this.updateShocks(dt);

    for (const s of this.stars) s.phase += s.rate * dt;
  }

  private updateNodes(dt: number): void {
    const influence = 170;
    const inf2 = influence * influence;

    for (const n of this.nodes) {
      // Cursor repulsion — nodes shy away from the pointer.
      if (this.mx > -9000) {
        const dx = n.x - this.mx;
        const dy = n.y - this.my;
        const d2 = dx * dx + dy * dy;
        if (d2 < inf2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / influence) * 240;
          n.vx += (dx / d) * force * dt;
          n.vy += (dy / d) * force * dt;
        }
      }

      // Shockwaves shove nodes outward as the ring passes them.
      for (const s of this.shocks) {
        const dx = n.x - s.x;
        const dy = n.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const band = Math.abs(d - s.r);
        if (band < 46) {
          const force = (1 - band / 46) * 520 * (1 - s.life / s.maxLife);
          n.vx += (dx / d) * force * dt;
          n.vy += (dy / d) * force * dt;
        }
      }

      n.x += n.vx * dt;
      n.y += n.vy * dt;

      // Drag, so pushes settle instead of accelerating forever.
      n.vx *= 0.975;
      n.vy *= 0.975;

      // Keep a slow ambient drift going.
      const speed = Math.hypot(n.vx, n.vy);
      if (speed < 5) {
        n.vx += (Math.random() - 0.5) * 9 * dt * 10;
        n.vy += (Math.random() - 0.5) * 9 * dt * 10;
      }

      // Wrap at the edges.
      if (n.x < -20) n.x = this.w + 20;
      else if (n.x > this.w + 20) n.x = -20;
      if (n.y < -20) n.y = this.h + 20;
      else if (n.y > this.h + 20) n.y = -20;
    }
  }

  private updateMeteors(dt: number): void {
    const density = this.theme.meteorDensity() * this.raf.quality();
    if (density > 0) {
      this.spawnAcc += dt * density;
      while (this.spawnAcc >= 0.55) {
        this.spawnAcc -= 0.55;
        this.spawnMeteor();
      }
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life += dt;

      if (m.fireball && this.sparks.length < 150 && Math.random() < 0.5) {
        this.sparks.push({
          x: m.x,
          y: m.y,
          vx: (Math.random() - 0.5) * 60 - m.vx * 0.04,
          vy: (Math.random() - 0.5) * 60 - m.vy * 0.04,
          life: 0,
          maxLife: 0.5 + Math.random() * 0.6,
          size: 0.7 + Math.random() * 1.4,
        });
      }

      if (m.x < -400 || m.y > this.h + 400 || m.life > m.maxLife) this.meteors.splice(i, 1);
    }
  }

  private updateSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;
      p.vx *= 0.97;
      p.life += dt;
      if (p.life >= p.maxLife) this.sparks.splice(i, 1);
    }
  }

  private updateShocks(dt: number): void {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life += dt;
      s.r = 8 + (s.life / s.maxLife) * 190;
      if (s.life >= s.maxLife) this.shocks.splice(i, 1);
    }
  }

  private spawnMeteor(): void {
    const angle = Math.PI * 0.78 + (Math.random() - 0.5) * 0.5;
    const fireball = Math.random() < 0.13;
    const speed = (fireball ? 320 : 470) + Math.random() * 320;
    const t = Math.random();

    this.meteors.push({
      x: this.radiantX - t * this.w * 1.5,
      y: this.radiantY + t * this.h * 0.55 + Math.random() * this.h * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.abs(Math.sin(angle)) * speed,
      len: fireball ? 150 + Math.random() * 130 : 70 + Math.random() * 110,
      width: fireball ? 2.6 + Math.random() * 1.6 : 1 + Math.random() * 1.2,
      life: 0,
      maxLife: 4,
      fireball,
    });
  }

  /** Click ripple: a ring that shoves the network plus a spark burst. */
  private shock(x: number, y: number): void {
    if (this.theme.reducedMotion()) return;
    this.shocks.push({ x, y, life: 0, maxLife: 0.62, r: 8 });

    const n = Math.round(18 * this.raf.quality());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const s = 100 + Math.random() * 240;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 0.34 + Math.random() * 0.4,
        size: 1 + Math.random() * 2.2,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.w, this.h);

    const accent = this.theme.accentRgb();
    const alt = this.theme.accentAltRgb();

    this.drawStars(ctx, accent);
    this.drawLinks(ctx, accent);
    this.drawNodes(ctx, accent);
    this.drawMeteors(ctx, accent, alt);
    this.drawSparks(ctx, accent, alt);
    this.drawShocks(ctx, accent);

    void dt;
  }

  /**
   * Stars, batched into alpha bands.
   *
   * One path per band rather than per star: ~12 draw calls instead of ~600
   * fillStyle writes and path builds.
   */
  private drawStars(ctx: CanvasRenderingContext2D, accent: string): void {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const px = this.mx > -9000 ? this.mx - cx : 0;
    const py = this.my > -9000 ? this.my - cy : 0;

    // Buckets hold indices, not Star references, so no per-frame Map or
    // object lookups are needed. The scratch arrays are reused across frames.
    this.ensureScratch();
    const warm = this.warmBuckets;
    const cool = this.coolBuckets;
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      warm[b].length = 0;
      cool[b].length = 0;
    }

    const sx = this.sx;
    const sy = this.sy;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const par = 0.25 + s.depth * 0.75;

      let x = (s.x - px * 0.012 * par) % this.w;
      if (x < 0) x += this.w;
      let y = (s.y - py * 0.012 * par - this.scrollY * 0.06 * par) % this.h;
      if (y < 0) y += this.h;

      sx[i] = x;
      sy[i] = y;

      const a = s.alpha * (0.65 + 0.35 * Math.sin(s.phase));
      const bucket = Math.min(ALPHA_BUCKETS - 1, Math.max(0, Math.floor(a * ALPHA_BUCKETS)));
      (s.depth > 0.72 ? warm : cool)[bucket].push(i);
    }

    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const a = ((b + 0.5) / ALPHA_BUCKETS).toFixed(2);

      if (cool[b].length) {
        ctx.fillStyle = `rgba(255, 250, 250, ${a})`;
        ctx.beginPath();
        for (const i of cool[b]) {
          const size = this.stars[i].r * 1.9;
          ctx.rect(sx[i], sy[i], size, size);
        }
        ctx.fill();
      }

      if (warm[b].length) {
        ctx.fillStyle = `rgba(${accent}, ${a})`;
        ctx.beginPath();
        for (const i of warm[b]) {
          const size = this.stars[i].r * 2.1;
          ctx.rect(sx[i], sy[i], size, size);
        }
        ctx.fill();
      }
    }
  }

  private warmBuckets: number[][] = [];
  private coolBuckets: number[][] = [];
  private linkBands: number[][] = [];
  private sx: number[] = [];
  private sy: number[] = [];

  private ensureScratch(): void {
    if (this.warmBuckets.length === ALPHA_BUCKETS) return;
    this.warmBuckets = Array.from({ length: ALPHA_BUCKETS }, () => []);
    this.coolBuckets = Array.from({ length: ALPHA_BUCKETS }, () => []);
  }

  /** Constellation lines: node-to-node, plus node-to-cursor. */
  private drawLinks(ctx: CanvasRenderingContext2D, accent: string): void {
    if (this.raf.quality() < 0.5) return;

    const link = 132;
    const link2 = link * link;
    const cursorLink = 210;
    const cursorLink2 = cursorLink * cursorLink;

    // Line opacity is bucketed too, so each strength band is a single stroked
    // path. Band arrays are flat index pairs reused across frames — no
    // per-frame allocation in the hot loop.
    if (this.linkBands.length !== 4) {
      this.linkBands = Array.from({ length: 4 }, () => [] as number[]);
    }
    const bands = this.linkBands;
    for (let b = 0; b < 4; b++) bands[b].length = 0;

    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > link2) continue;

        const band = Math.min(3, Math.floor((1 - d2 / link2) * 4));
        bands[band].push(i, j);
      }
    }

    for (let band = 0; band < 4; band++) {
      const list = bands[band];
      if (!list.length) continue;
      ctx.strokeStyle = `rgba(${accent}, ${(0.05 + band * 0.055).toFixed(3)})`;
      ctx.lineWidth = 0.6 + band * 0.2;
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 2) {
        const a = nodes[list[k]];
        const b = nodes[list[k + 1]];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }

    // Lines reaching out to the cursor — the bit that makes it feel alive.
    if (this.mx > -9000) {
      ctx.strokeStyle = `rgba(${accent}, 0.3)`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      let drawn = 0;
      for (const n of this.nodes) {
        const dx = n.x - this.mx;
        const dy = n.y - this.my;
        if (dx * dx + dy * dy > cursorLink2) continue;
        ctx.moveTo(this.mx, this.my);
        ctx.lineTo(n.x, n.y);
        if (++drawn > 14) break;
      }
      ctx.stroke();
    }
  }

  private drawNodes(ctx: CanvasRenderingContext2D, accent: string): void {
    ctx.fillStyle = `rgba(${accent}, 0.55)`;
    ctx.beginPath();
    for (const n of this.nodes) {
      ctx.moveTo(n.x + n.r, n.y);
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private drawMeteors(ctx: CanvasRenderingContext2D, accent: string, alt: string): void {
    for (const m of this.meteors) {
      const speed = Math.hypot(m.vx, m.vy) || 1;
      const tailX = m.x - (m.vx / speed) * m.len;
      const tailY = m.y - (m.vy / speed) * m.len;
      const fade = Math.min(1, m.life * 6) * Math.max(0, 1 - m.life / m.maxLife);

      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, `rgba(255, 252, 250, ${0.95 * fade})`);
      grad.addColorStop(m.fireball ? 0.2 : 0.3, `rgba(${alt}, ${0.7 * fade})`);
      grad.addColorStop(0.6, `rgba(${accent}, ${0.3 * fade})`);
      grad.addColorStop(1, `rgba(${accent}, 0)`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      const headR = m.width * (m.fireball ? 2.4 : 1.5) * 4;
      const hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, headR);
      hg.addColorStop(0, `rgba(255, 253, 250, ${0.95 * fade})`);
      hg.addColorStop(0.4, `rgba(${alt}, ${0.4 * fade})`);
      hg.addColorStop(1, `rgba(${accent}, 0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, headR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawSparks(ctx: CanvasRenderingContext2D, accent: string, alt: string): void {
    for (const p of this.sparks) {
      const a = Math.max(0, 1 - p.life / p.maxLife);
      ctx.fillStyle = a > 0.6 ? `rgba(${alt}, ${a})` : `rgba(${accent}, ${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawShocks(ctx: CanvasRenderingContext2D, accent: string): void {
    for (const s of this.shocks) {
      const t = s.life / s.maxLife;
      ctx.strokeStyle = `rgba(${accent}, ${(1 - t) * 0.7})`;
      ctx.lineWidth = 2.4 * (1 - t) + 0.4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
