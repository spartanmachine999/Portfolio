import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RevealDirective } from '../../directives/reveal.directive';
import { TiltDirective } from '../../directives/tilt.directive';
import { AudioService } from '../../services/audio.service';
import { PortfolioDataService } from '../../services/portfolio-data.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, TiltDirective],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class ProjectsComponent {
  protected readonly data = inject(PortfolioDataService);
  private readonly audio = inject(AudioService);

  /** Titles of the cards whose full description is showing. */
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  isOpen(title: string): boolean {
    return this.expanded().has(title);
  }

  toggle(title: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
    this.audio.play('blip');
  }
}
