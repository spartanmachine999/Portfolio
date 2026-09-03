export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  description: string[];
  /** Marks the role as ongoing so the timeline can flag it as active. */
  current?: boolean;
}
