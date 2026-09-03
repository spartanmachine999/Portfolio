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
import { RouterLink } from '@angular/router';
import { AudioService } from '../../services/audio.service';
import { RafService } from '../../services/raf.service';
import { ThemeService } from '../../services/theme.service';

interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hit: boolean;
  life: number;
}

const W = 480;
const H = 300;

/**
 * 404 page with a small whack-the-debris game.
 *
 * Kept trivial on purpose: a dead link is a dead end, and the game is here to
 * make that pleasant rather than to be a second arcade.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFoundComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly raf = inject(RafService);
  private readonly audio = inject(AudioService);
  private readonly theme = inject(ThemeService);

  readonly score = signal(0);
  readonly best = signal(0);

  private ctx: CanvasRenderingContext2D | null = null;
  private stop?: () => void;
  private targets: Target[] = [];
  private spawn = 0;

  ngAfterViewInit(): void {
    const c = this.canvasRef().nativeElement;
    c.width = W;
    c.height = H;
    this.ctx = c.getContext('2d');
    if (!this.ctx) return;

    this.render();
    if (!this.theme.reducedMotion()) {
      this.stop = this.raf.add((dt) => {
        this.update(dt);
        this.render();
      });
    }
  }

  ngOnDestroy(): void {
    this.stop?.();
  }

  onTap(event: PointerEvent): void {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    if (!rect.width) return;

    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;

    for (const t of this.targets) {
      if (t.hit) continue;
      const dx = t.x - x;
      const dy = t.y - y;
      if (dx * dx + dy * dy <= t.r * t.r * 1.6) {
        t.hit = true;
        t.life = 0;
        this.audio.play('explode');
        const next = this.score() + 1;
        this.score.set(next);
        if (next > this.best()) this.best.set(next);
        return;
      }
    }
  }

  private update(dt: number): void {
    this.spawn -= dt;
    if (this.spawn <= 0 && this.targets.length < 7) {
      this.spawn = 0.7;
      const r = 13 + Math.random() * 11;
      this.targets.push({
        x: r + Math.random() * (W - r * 2),
        y: -r,
        vx: (Math.random() - 0.5) * 50,
        vy: 42 + Math.random() * 40,
        r,
        hit: false,
        life: 0,
      });
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.hit) {
        t.life += dt;
        if (t.life > 0.3) this.targets.splice(i, 1);
        continue;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < t.r || t.x > W - t.r) t.vx *= -1;
      if (t.y > H + t.r) this.targets.splice(i, 1);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const accent = this.theme.accentRgb();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, W, H);

    for (const t of this.targets) {
      if (t.hit) {
        const a = 1 - t.life / 0.3;
        ctx.strokeStyle = `rgba(${accent}, ${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r + (1 - a) * 22, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }

      ctx.fillStyle = `rgba(${accent}, 0.16)`;
      ctx.strokeStyle = `rgba(${accent}, 0.85)`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
