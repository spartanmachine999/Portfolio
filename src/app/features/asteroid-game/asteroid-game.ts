import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';

type Status = 'ready' | 'playing' | 'paused' | 'over';

interface Bullet {
  x: number;
  y: number;
  vy: number;
}

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  rot: number;
  vrot: number;
  verts: number[];
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

// Fixed logical playfield. The canvas is scaled to fit its box, so the game
// plays identically on a phone and a 4K monitor.
const VW = 480;
const VH = 640;
const HISCORE_KEY = 'ms-portfolio-hiscore';

/**
 * METEOR DEFENSE — a small arcade shooter themed to match the site.
 *
 * Design notes:
 *  - The render loop runs outside the Angular zone; only discrete HUD changes
 *    (score, lives, level) are pushed back in via zone.run so the overlay
 *    updates without re-rendering the app 60 times a second.
 *  - Collision uses squared distances to avoid a sqrt per pair per frame.
 *  - Rocks are procedural polygons rather than circles, which reads much more
 *    like debris.
 */
@Component({
  selector: 'app-asteroid-game',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asteroid-game.html',
  styleUrl: './asteroid-game.css',
})
export class AsteroidGameComponent implements AfterViewInit, OnDestroy {
  readonly closed = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly audio = inject(AudioService);

  readonly status = signal<Status>('ready');
  readonly score = signal(0);
  readonly lives = signal(3);
  readonly level = signal(1);
  readonly hiScore = signal(this.readHiScore());
  readonly isNewRecord = computed(() => this.score() > 0 && this.score() >= this.hiScore());

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private last = 0;

  private shipX = VW / 2;
  private shipCooldown = 0;
  private invuln = 0;

  private bullets: Bullet[] = [];
  private rocks: Rock[] = [];
  private embers: Ember[] = [];

  private spawnTimer = 0;
  private moveLeft = false;
  private moveRight = false;
  private firing = false;
  private pointerTarget: number | null = null;
  private started = false;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveLeft = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveRight = true;
        e.preventDefault();
        break;
      case ' ':
        this.firing = true;
        e.preventDefault();
        break;
      case 'p':
      case 'P':
        this.togglePause();
        break;
      case 'Escape':
        this.close();
        break;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveLeft = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveRight = false;
        break;
      case ' ':
        this.firing = false;
        break;
    }
  };

  constructor() {
    // The component only exists while the game is open, so binding here and
    // unbinding in ngOnDestroy scopes the keys to the game's lifetime.
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  ngOnDestroy(): void {
    this.stopLoop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ---------------------------------------------------------------------------
  // Public controls (bound in the template)
  // ---------------------------------------------------------------------------

  start(): void {
    this.reset();
    this.status.set('playing');
    this.audio.play('levelup');
    this.startLoop();
  }

  togglePause(): void {
    if (this.status() === 'playing') {
      this.status.set('paused');
      this.stopLoop();
    } else if (this.status() === 'paused') {
      this.status.set('playing');
      this.startLoop();
    }
  }

  close(): void {
    this.stopLoop();
    this.closed.emit();
  }

  // Touch / mouse steering
  onPointerDown(e: PointerEvent): void {
    if (this.status() === 'ready') {
      this.start();
      return;
    }
    this.trackPointer(e);
    this.firing = true;
  }

  onPointerMove(e: PointerEvent): void {
    if (this.pointerTarget !== null) this.trackPointer(e);
  }

  onPointerUp(): void {
    this.pointerTarget = null;
    this.firing = false;
  }

  private trackPointer(e: PointerEvent): void {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    if (!rect.width) return;
    this.pointerTarget = ((e.clientX - rect.left) / rect.width) * VW;
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  /**
   * Size the backing store and paint one frame straight away.
   *
   * Without this the canvas sat at the browser default 300x150 until the player
   * pressed Launch, so the board behind the intro overlay was an unsized blank.
   */
  ngAfterViewInit(): void {
    this.initCanvas();
    this.render();
  }

  private initCanvas(): CanvasRenderingContext2D | null {
    if (this.ctx) return this.ctx;
    const canvas = this.canvasRef().nativeElement;
    canvas.width = VW;
    canvas.height = VH;
    this.ctx = canvas.getContext('2d');
    return this.ctx;
  }

  private startLoop(): void {
    this.initCanvas();
    if (!this.ctx || this.raf) return;

    this.last = performance.now();
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame((t) => this.frame(t));
    });
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    if (this.status() === 'playing') this.update(dt);
    this.render();

    if (this.status() === 'playing') {
      this.raf = requestAnimationFrame((t) => this.frame(t));
    } else {
      this.raf = 0;
    }
  }

  private reset(): void {
    this.shipX = VW / 2;
    this.bullets = [];
    this.rocks = [];
    this.embers = [];
    this.spawnTimer = 0;
    this.shipCooldown = 0;
    this.invuln = 1.2;
    this.started = true;
    this.zone.run(() => {
      this.score.set(0);
      this.lives.set(3);
      this.level.set(1);
    });
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private update(dt: number): void {
    const lvl = this.level();

    // --- Ship ---
    const speed = 340;
    if (this.pointerTarget !== null) {
      this.shipX += (this.pointerTarget - this.shipX) * Math.min(1, dt * 12);
    } else {
      if (this.moveLeft) this.shipX -= speed * dt;
      if (this.moveRight) this.shipX += speed * dt;
    }
    this.shipX = Math.max(22, Math.min(VW - 22, this.shipX));

    if (this.invuln > 0) this.invuln -= dt;

    // --- Firing ---
    this.shipCooldown -= dt;
    if (this.firing && this.shipCooldown <= 0) {
      this.bullets.push({ x: this.shipX, y: VH - 62, vy: -560 });
      this.shipCooldown = 0.16;
      this.audio.play('shoot');
    }

    // --- Bullets ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < -20) this.bullets.splice(i, 1);
    }

    // --- Spawning ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnRock();
      this.spawnTimer = Math.max(0.28, 1.15 - lvl * 0.075);
    }

    // --- Rocks ---
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vrot * dt;

      if (r.x < r.r || r.x > VW - r.r) r.vx *= -1;

      if (r.y > VH + r.r) {
        this.rocks.splice(i, 1);
        continue;
      }

      // Rock vs ship
      const dx = r.x - this.shipX;
      const dy = r.y - (VH - 46);
      const reach = r.r + 15;
      if (this.invuln <= 0 && dx * dx + dy * dy < reach * reach) {
        this.rocks.splice(i, 1);
        this.burst(r.x, r.y, 26);
        this.audio.play('hit');
        this.invuln = 1.5;
        const remaining = this.lives() - 1;
        this.zone.run(() => this.lives.set(remaining));
        if (remaining <= 0) this.gameOver();
        continue;
      }

      // Rock vs bullets
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        const bdx = r.x - b.x;
        const bdy = r.y - b.y;
        if (bdx * bdx + bdy * bdy > r.r * r.r) continue;

        this.bullets.splice(j, 1);
        r.hp -= 1;

        if (r.hp <= 0) {
          this.rocks.splice(i, 1);
          this.burst(r.x, r.y, 18);
          this.audio.play('explode');

          const gain = Math.round(14 + r.r);
          const next = this.score() + gain;
          const nextLevel = Math.floor(next / 320) + 1;
          const levelled = nextLevel > this.level();

          this.zone.run(() => {
            this.score.set(next);
            if (levelled) this.level.set(nextLevel);
          });
          if (levelled) this.audio.play('levelup');

          // Big rocks break into two smaller ones.
          if (r.r > 20) {
            for (let k = 0; k < 2; k++) {
              this.rocks.push(
                this.makeRock(r.x + (k ? 8 : -8), r.y, r.r * 0.58, {
                  vx: (k ? 1 : -1) * (40 + Math.random() * 60),
                  vy: r.vy * (0.9 + Math.random() * 0.3),
                }),
              );
            }
          }
        } else {
          this.burst(r.x, r.y, 5);
        }
        break;
      }
    }

    // --- Embers ---
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= 0.97;
      e.vy = e.vy * 0.97 + 60 * dt;
      e.life += dt;
      if (e.life >= e.maxLife) this.embers.splice(i, 1);
    }
  }

  private spawnRock(): void {
    const lvl = this.level();
    const r = 14 + Math.random() * 20;
    this.rocks.push(
      this.makeRock(r + Math.random() * (VW - r * 2), -r - 6, r, {
        vx: (Math.random() - 0.5) * 70,
        vy: 58 + Math.random() * 42 + lvl * 9,
      }),
    );
  }

  private makeRock(x: number, y: number, r: number, v: { vx: number; vy: number }): Rock {
    // Pre-generate an irregular silhouette so it looks like debris, not a ball.
    const n = 9;
    const verts: number[] = [];
    for (let i = 0; i < n; i++) verts.push(0.72 + Math.random() * 0.46);

    return {
      x,
      y,
      r,
      vx: v.vx,
      vy: v.vy,
      hp: r > 26 ? 3 : r > 18 ? 2 : 1,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.6,
      verts,
    };
  }

  private burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 170;
      this.embers.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.5,
        size: 1 + Math.random() * 2.2,
      });
    }
  }

  private gameOver(): void {
    this.audio.play('gameover');
    const final = this.score();
    const best = Math.max(final, this.hiScore());
    this.writeHiScore(best);
    this.zone.run(() => {
      this.hiScore.set(best);
      this.status.set('over');
    });
    this.stopLoop();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = '#080405';
    ctx.fillRect(0, 0, VW, VH);

    // Faint grid for depth
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= VW; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, VH);
      ctx.stroke();
    }
    for (let gy = 0; gy <= VH; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(VW, gy);
      ctx.stroke();
    }

    this.drawRocks(ctx);
    this.drawBullets(ctx);
    this.drawEmbers(ctx);
    if (this.started && this.status() !== 'over') this.drawShip(ctx);
  }

  private drawShip(ctx: CanvasRenderingContext2D): void {
    const y = VH - 46;
    // Blink while invulnerable.
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.shipX, y);

    // Engine plume
    const plume = ctx.createLinearGradient(0, 10, 0, 34);
    plume.addColorStop(0, 'rgba(255, 160, 90, 0.85)');
    plume.addColorStop(1, 'rgba(255, 60, 60, 0)');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 30 + Math.random() * 8);
    ctx.closePath();
    ctx.fill();

    // Hull
    ctx.fillStyle = '#f3eaea';
    ctx.strokeStyle = '#ff3c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(13, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#ff3c3c';
    ctx.beginPath();
    ctx.arc(0, -4, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawRocks(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);

      ctx.beginPath();
      const n = r.verts.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rad = r.r * r.verts[i];
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const g = ctx.createRadialGradient(-r.r * 0.3, -r.r * 0.3, r.r * 0.1, 0, 0, r.r);
      g.addColorStop(0, r.hp > 1 ? '#4a2126' : '#33181c');
      g.addColorStop(1, '#160a0c');
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = r.hp > 2 ? '#ff6b6b' : r.hp > 1 ? '#c8323c' : '#7d2228';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      const g = ctx.createLinearGradient(b.x, b.y - 12, b.x, b.y + 6);
      g.addColorStop(0, 'rgba(255, 255, 255, 0)');
      g.addColorStop(0.5, '#fff3f3');
      g.addColorStop(1, 'rgba(255, 60, 60, 0.1)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 1.6, b.y - 12, 3.2, 18);

      ctx.fillStyle = 'rgba(255, 60, 60, 0.5)';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEmbers(ctx: CanvasRenderingContext2D): void {
    for (const e of this.embers) {
      const a = Math.max(0, 1 - e.life / e.maxLife);
      ctx.fillStyle = `rgba(255, ${Math.round(120 + a * 120)}, ${Math.round(70 + a * 40)}, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // High score persistence
  // ---------------------------------------------------------------------------

  private readHiScore(): number {
    try {
      const v = Number(localStorage.getItem(HISCORE_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  private writeHiScore(v: number): void {
    try {
      localStorage.setItem(HISCORE_KEY, String(v));
    } catch {
      /* ignore */
    }
  }
}
