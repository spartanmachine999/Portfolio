import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AboutComponent } from '../../sections/about/about';
import { ExperienceComponent } from '../../sections/experience/experience';
import { HeroComponent } from '../../sections/hero/hero';
import { ProjectsComponent } from '../../sections/projects/projects';
import { SkillsComponent } from '../../sections/skills/skills';

/** The main page. Everything routed lives under here. */
@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroComponent,
    AboutComponent,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
  ],
  template: `
    <app-hero />

    <!-- Track duplicated so the marquee can loop seamlessly at -50%. -->
    <div class="ticker" aria-hidden="true">
      <div class="ticker-track">
        @for (item of ticker; track $index) {
          <span><b>//</b> {{ item }}</span>
        }
        @for (item of ticker; track $index) {
          <span><b>//</b> {{ item }}</span>
        }
      </div>
    </div>

    <app-about />
    <app-experience />
    <app-projects />
    <app-skills />
  `,
})
export class HomeComponent {
  readonly ticker = [
    'Associate Product Manager 💼',
    'Biz2X',
    'Computer Science / AI & ML 🤖',
    'IIM Ahmedabad Research 🔬',
    'Python · SQL · PowerBI',
    'Jira · Confluence · Figma',
    'Delhi, India 📍',
    'Press Ctrl+K ⌘',
    'Try the rocket 🚀',
  ];
}
