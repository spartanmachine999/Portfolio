import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RevealDirective } from '../../directives/reveal.directive';
import { PortfolioDataService } from '../../services/portfolio-data.service';

@Component({
  selector: 'app-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class AboutComponent {
  protected readonly data = inject(PortfolioDataService);

  protected readonly facts = [
    { label: 'Based in', value: this.data.contact.location },
    { label: 'Currently', value: this.data.role + ' @ Biz2X' },
    { label: 'Background', value: 'Computer Science (AI & ML)' },
  ];
}
