import { Injectable, signal } from '@angular/core';
import { ExperienceItem } from '../models/experience.model';
import { ProjectItem } from '../models/project.model';

/**
 * Single source of truth for every piece of content on the site.
 *
 * If you want to change what the portfolio *says* — a new job, a new project,
 * a new skill — this is the only file you need to touch. Everything is plain
 * text and plain arrays. No framework knowledge required.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioDataService {
  // ---------------------------------------------------------------------------
  // Personal info
  // ---------------------------------------------------------------------------
  readonly name = 'Mohak Saxena';
  readonly role = 'Associate Product Manager';

  readonly contact = {
    phone: '8595551445',
    email: 'mohaksaxena16@gmail.com',
    location: 'Delhi, India',
    linkedin: 'https://www.linkedin.com/in/mohaksaxena16',
    resume: '/Mohak_Saxena_Resume.pdf',
  } as const;

  /** Cycled through by the typewriter effect in the hero. */
  readonly taglines = signal<string[]>([
    'Associate Product Manager @ Biz2X',
    'Computer Science Engineer (AI & ML)',
    'Former Research Intern @ IIM Ahmedabad',
    'Turning messy problems into shipped products',
  ]);

  readonly intro =
    'Associate Product Manager at Biz2X with a Computer Science (AI/ML) background, ' +
    'blending product execution with data-driven decision-making to build scalable, ' +
    'user-centric solutions.';

  readonly about =
    'Associate Product Manager at Biz2X with a background in Computer Science Engineering ' +
    '(AI & ML). I work across the product lifecycle, from gathering requirements and sprint ' +
    'planning to execution, using tools like Jira, Confluence, and CRM systems. Skilled in ' +
    'Python, SQL, and data visualization, I apply my analytical background to product ' +
    'management with a focus on building scalable solutions, improving user experiences, ' +
    'and driving data-backed decisions.';

  // ---------------------------------------------------------------------------
  // Experience — newest first
  // ---------------------------------------------------------------------------
  readonly experience = signal<ExperienceItem[]>([
    {
      company: 'Biz2X',
      role: 'Associate Product Manager',
      duration: 'September 2025 - Present',
      current: true,
      description: [
        'Supported product roadmap execution by writing detailed user stories in Jira and collaborating closely with engineering and design teams.',
        'Conducted user and market research to inform feature prioritization, documenting insights and recommendations in Confluence.',
        'Contributed to product launches and continuous improvements by tracking feature adoption and analyzing performance metrics to identify optimization opportunities.',
      ],
    },
    {
      company: 'IIM Ahmedabad',
      role: 'Research Intern',
      duration: 'Jan 2025 - Jun 2025',
      description: [
        'Worked on AI driven crowd management for the Kumbh Mela, focusing on large-scale event logistics and public safety.',
        'Utilized computer vision, predictive analytics and real time monitoring to analyse movement patterns.',
        'Explored drone-based surveillance, IoT sensors, and geospatial mapping to enhance event efficiency and crowd control.',
      ],
    },
    {
      company: 'Bharat Electronics Limited',
      role: 'Project Intern',
      duration: 'Jul 2024 - Aug 2024',
      description: [
        'Developed an intelligent chatbot using the Rasa framework, with multi-turn dialogues and custom actions.',
        'Integrated the chatbot with a web interface using Flask, creating a user-friendly frontend with HTML, CSS and JS.',
        'Deployed and maintained the Rasa server, ensuring smooth interaction via REST API.',
      ],
    },
    {
      company: 'Impetus Technologies',
      role: 'SDE Intern',
      duration: 'Aug 2023 - Oct 2023',
      description: [
        'Developed and executed a comprehensive PySpark and AWS project to process and optimize large datasets.',
        'Proficiently implemented data cleaning and transformation methodologies, resulting in enhanced data quality and analysis capabilities.',
        'Effectively leveraged AWS tools to streamline data processing, enabling data-driven decision-making.',
      ],
    },
  ]);

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
  readonly projects = signal<ProjectItem[]>([
    {
      title: 'Ecom-Ingestion Platform',
      blurb: 'Large-scale data pipeline built for throughput and data quality.',
      description:
        'This project focuses on processing and optimizing large-scale datasets to improve data quality ' +
        'and support advanced analytics. Through the implementation of robust data cleaning and ' +
        'transformation techniques, the project enhances the reliability and usability of data. AWS ' +
        'services were integrated to streamline data pipelines, enabling faster processing and ' +
        'empowering data-driven decision-making across systems.',
      techStack: ['AWS Glue', 'Athena', 'SNS / SQS', 'PySpark', 'Apache'],
    },
    {
      title: 'FinSight — Real-Time Stock Market Analytics',
      blurb: 'Live market dashboard with ML-driven anomaly detection.',
      description:
        'FinSight is a web-based analytics dashboard that helps users track and analyze stock market ' +
        'trends in real time. Built for retail investors and analysts, the platform aggregates live ' +
        'financial data, including stock prices, trading volumes, and market sentiment from news ' +
        'sources and social media. It uses machine learning models to detect unusual market movements, ' +
        'forecast price trends, and assess portfolio risk. Users can visualize historical performance, ' +
        'compare asset classes, and set up alerts for key technical indicators. The platform is ' +
        'optimized for speed and scalability using AWS services, with a frontend built in React and ' +
        'real-time updates powered by WebSockets.',
      techStack: ['Python', 'SQL', 'AWS', 'Node.js', 'React.js', 'WebSockets'],
    },
  ]);

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------
  readonly coreSkills = signal<string[]>([
    'Requirements Analysis',
    'User-Centric Design',
    'Analytical Thinking',
    'Problem-Solving',
  ]);

  readonly technicalTools = signal<string[]>([
    'Python',
    'SQL',
    'PowerBI',
    'Alteryx',
    'Jupyter Notebook',
    'Tableau',
    'Jira',
    'Confluence',
    'Figma',
  ]);

  readonly softSkills = signal<string[]>([
    'Stakeholder Communication',
    'Teamwork',
    'Leadership',
    'Adaptability',
    'Curiosity & Learning Agility',
  ]);
}
