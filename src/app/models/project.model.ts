export interface ProjectItem {
  title: string;
  description: string;
  techStack: string[];
  /** One-line summary shown before the full description is expanded. */
  blurb?: string;
  /** Optional outbound links. Left undefined when there is nothing to link to. */
  repo?: string;
  demo?: string;
}
