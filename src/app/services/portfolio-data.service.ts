import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ExperienceItem } from '../models/experience.model';
import { ProjectItem } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  // Personal Info
  readonly name = 'Mohak Saxena';
  readonly contact = {
    phone: '8595551445',
    email: 'mohaksaxena16@gmail.com',
    location: 'Delhi'
  } as const;

  // Experience
  private readonly experienceSignal = signal<ExperienceItem[]>([
        {
      company: 'Biz2x',
      role: 'Associate Product Manager',
      duration: 'Septemeber 2025 - Present',
      description: [
        'Supported product roadmap execution by writing detailed user stories in Jira and collaborating closely with engineering and design teams.',
        'Conducted user and market research to inform feature prioritization, documenting insights and recommendations in Confluence.',
        'Contributed to product launches and continuous improvements by tracking feature adoption and analyzing performance metrics to identify optimization opportunities.'
      ]
    },
    {
      company: 'IIM Ahmedabad',
      role: 'Research Intern',
      duration: 'Jan 2025 - Jun 2025',
      description: [
        'Worked on AI driven crowd management for the Kumbh Mela, focusing on large-scale event logistics and public safety.',
        'Utilized computer vision, predicitve analytics and real time monitoring to analyse movement patterns.',
        'Explored drone-based surveillance, IoT sensors, and geospatial mapping to enhance even efficiency and crowd control.'
      ]
    },
       {
      company: 'Bharat Electronics Limited',
      role: 'Project Intern',
      duration: 'Jul 2024 - Aug 2024',
      description: [
        'Developed an intelligent chatbot using the Rasa framework, multi-turn dialogues and custom actions.',
        'Integrated the chatbot with a web interface using Flask, creating a user-friendly frontend with HTML, CSS and JS.',
        'Deployed and maintained the Rasa server, ensuring smooth interaction via REST API.'
      ]
    },
       {
      company: 'Impetus Technologies',
      role: 'SDE Intern',
      duration: 'Aug 2023 - Oct 2023',
      description: [
        'Developed and executed a comprehensive PySpark and AWS project to process and optimize large datasets.',
        'Proficiently implemented data cleaning and transformation methodologies, resulting in enhanced data quality and analysis capabilities.',
        'Effectively leveraged AWS tools to streamline data processing, enabling data-driven decision-making.'
      ]
    }
  ]);
  readonly experience$ = toObservable(this.experienceSignal);

  // Projects
  private readonly projectsSignal = signal<ProjectItem[]>([
    {
      title: 'Ecom-Ingestion Platform',
      description: 'This project focuses on processing and optimizing large-scale datasets to improve data quality and support advanced analytics. Through the implementation of robust data cleaning and transformation techniques, the project enhances the reliability and usability of data. AWS services were integrated to streamline data pipelines, enabling faster processing and empowering data-driven decision-making across systems.',
      techStack: ['AWS - Glue, Athena, SNS, SQS', 'Pyspark', 'Apache',]
    },
    {
      title: 'Real-Time Stock Market Analytics',
      description: 'FinSight is a web-based analytics dashboard that helps users track and analyze stock market trends in real time. Built for retail investors and analysts, the platform aggregates live financial data, including stock prices, trading volumes, and market sentiment from news sources and social media. It uses machine learning models to detect unusual market movements, forecast price trends, and assess portfolio risk. Users can visualize historical performance, compare asset classes, and set up alerts for key technical indicators. The platform is optimized for speed and scalability using AWS services, with a frontend built in React and real-time updates powered by WebSockets.',
      techStack: ['SQL', 'AWS', 'Python','Node.js(Collaborated)','React.js(Collaborated)']
    }
  ]);
  readonly projects$ = toObservable(this.projectsSignal);

  // Skills
  private readonly coreSkillsSignal = signal<string[]>([
    'Requirements Analysis',
    'User-Centric Design',
    'Analytical Thinking',
    'Problem-Solving'
  ]);
  readonly coreSkills$ = toObservable(this.coreSkillsSignal);

  private readonly technicalToolsSignal = signal<string[]>([
    'Python', 'SQL', 'PowerBI', 'Alteryx', 'Jupyter Notebook', 'Tableau', 'Jira', 'Confluence', 'Figma'
  ]);
  readonly technicalTools$ = toObservable(this.technicalToolsSignal);

  private readonly softSkillsSignal = signal<string[]>([
    'Stakeholder Communication', 'Teamwork', 'Leadership', 'Adaptability', 'Curiosity & Learning Agility'
  ]);
  readonly softSkills$ = toObservable(this.softSkillsSignal);
}


