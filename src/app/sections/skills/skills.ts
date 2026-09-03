import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RevealDirective } from '../../directives/reveal.directive';
import { PortfolioDataService } from '../../services/portfolio-data.service';

@Component({
  selector: 'app-skills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './skills.html',
  styleUrl: './skills.css',
})
export class SkillsComponent {
  private readonly data = inject(PortfolioDataService);

  protected readonly groups = computed(() => [
    { key: 'core', title: 'Core Skills', items: this.data.coreSkills() },
    { key: 'tools', title: 'Technical Tools', items: this.data.technicalTools() },
    { key: 'soft', title: 'Soft Skills', items: this.data.softSkills() },
  ]);
}
