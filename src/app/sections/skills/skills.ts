import { Component, inject } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { PortfolioDataService } from '../../services/portfolio-data.service';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  templateUrl: './skills.html',
  styleUrl: './skills.css'
})
export class SkillsComponent {
  protected data = inject(PortfolioDataService);
}


