export type JobType = "Testing" | "Developer" | "System";
export type Job = {
  id: string; company: string; role: string; location: string; experience: string; mode: string; type: JobType; fit: number; posted: string; salary?: string; matchedSkills: string[]; missingSkills: string[]; requirements: string[]; whyFit: string; applyUrl: string; source: string;
};
export const jobs: Job[] = [];
