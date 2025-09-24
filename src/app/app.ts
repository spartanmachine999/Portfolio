import { Component, signal } from '@angular/core';
import { HeaderComponent } from './layout/header/header';
import { HeroComponent } from './sections/hero/hero';
import { AboutComponent } from './sections/about/about';
import { ExperienceComponent } from './sections/experience/experience';
import { ProjectsComponent } from './sections/projects/projects';
import { SkillsComponent } from './sections/skills/skills';
import { FooterComponent } from './layout/footer/footer';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, HeroComponent, AboutComponent, ExperienceComponent, ProjectsComponent, SkillsComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Mohak-Portfolio');
}
