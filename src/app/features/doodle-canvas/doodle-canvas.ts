import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import { DoodleService } from '../../services/doodle.service';
import { RafService } from '../../services/raf.service';
import { ThemeService } from '../../services/theme.service';

/** Elements that must keep receiving clicks rather than becoming canvas. */
const INTERACTIVE =
  'a, button, input, textarea, select, label, [role="radio"], [role="option"], ' +
  'app-control-dock, app-command-palette, app-asteroid-game, app-synth-pad, ' +
  '.game-fab, .toast, .badge, .card, .avatar';

/**
 * Chalk drawing surface for doodle mode.
 *
 * Seamless integration is the whole trick here. The canvas always has
 * `pointer-events: none`, so it can never swallow a click; drawing is driven
 * from window-level pointer listeners which bail out the moment the gesture
 * starts on anything interactive. Dragging across empty board draws, tapping a
 * button still presses the button.
 *
 * Strokes live in page coordinates, so the canvas repaints on scroll rather than
 * letting drawings slide across the viewport.
 */
@Component({
  selector: 'app-doodle-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        /* Above the starfield, below all content. */
        z-index: 0;
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
export class DoodleCanvasComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly doodle = inject(DoodleService);
  private readonly theme = inject(ThemeService);
  private readonly raf = inject(RafService);

  private ctx: CanvasRenderingContext2D | null = null;
  private stop?: () => void;

  private w = 0;
  private h = 0;
  private drawing = false;

  // Repaint triggers: any of these changing means the picture is stale.
  private lastRevision = -1;
  private lastScroll = -1;
  private lastAccent = '';
  private lastDoodle: boolean | null = null;

  private readonly onResize = () => {
    this.resize();
    this.lastRevision = -1;
  };

  private readonly onDown = (e: PointerEvent) => {
    if (!this.theme.doodle()) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest(INTERACTIVE)) return;

    this.drawing = true;
    this.doodle.begin(e.clientX, e.clientY + window.scrollY);
  };

  private readonly onMove = (e: PointerEvent) => {
    if (!this.drawing) return;
    this.doodle.extend(e.clientX, e.clientY + window.scrollY);
  };

  private readonly onUp = () => {
    if (!this.drawing) return;
    this.drawing = false;
    this.doodle.end();
  };

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef().nativeElement.getContext('2d');
    if (!this.ctx) return;

    this.resize();

    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    window.addEventListener('pointercancel', this.onUp, { passive: true });

    // Repaint is demand-driven inside the shared loop: it does nothing at all
    // unless the drawing, the scroll position or the accent has changed.
    this.stop = this.raf.add(() => this.maybeRender());
  }

  ngOnDestroy(): void {
    this.stop?.();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  private resize(): void {
    const c = this.canvasRef().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    c.width = Math.floor(this.w * dpr);
    c.height = Math.floor(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private maybeRender(): void {
    const on = this.theme.doodle();
    const rev = this.doodle.revision();
    const scroll = Math.round(window.scrollY);
    const accent = this.theme.accentRgb();

    if (
      on === this.lastDoodle &&
      rev === this.lastRevision &&
      scroll === this.lastScroll &&
      accent === this.lastAccent
    ) {
      return;
    }

    this.lastDoodle = on;
    this.lastRevision = rev;
    this.lastScroll = scroll;
    this.lastAccent = accent;

    this.render(on, scroll, accent);
  }

  private render(on: boolean, scroll: number, accent: string): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.w, this.h);
    // Doodles belong to the board; hide them when the board is gone.
    if (!on) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const s of this.doodle.all()) {
      const pts = s.pts;
      if (pts.length < 4) continue;

      // Cheap vertical cull: skip strokes entirely off screen.
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < pts.length; i += 2) {
        if (pts[i] < minY) minY = pts[i];
        if (pts[i] > maxY) maxY = pts[i];
      }
      if (maxY - scroll < -60 || minY - scroll > this.h + 60) continue;

      // Three offset passes fake the grain of chalk: one solid core plus two
      // faint jittered passes either side.
      for (const pass of [
        { off: 0, width: 3.2, alpha: 0.85 },
        { off: -1.4, width: 1.6, alpha: 0.3 },
        { off: 1.4, width: 1.1, alpha: 0.22 },
      ]) {
        ctx.strokeStyle = `rgba(${accent}, ${pass.alpha})`;
        ctx.lineWidth = pass.width;
        ctx.beginPath();
        ctx.moveTo(pts[0] + pass.off, pts[1] - scroll + pass.off);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i] + pass.off, pts[i + 1] - scroll + pass.off);
        }
        ctx.stroke();
      }
    }
  }
}
