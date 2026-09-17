import { createHash } from "node:crypto";
import type { Job } from "@/lib/jobs";
import { createAdminSupabase } from "@/lib/supabase-admin";

const fingerprint = (job: Job) => createHash("sha256").update(`${job.company}|${job.role}|${job.location}|${job.applyUrl}`.toLowerCase()).digest("hex");

export async function persistJobs(jobs: Job[]) {
  const db = createAdminSupabase();
  const rows = jobs.map(job => ({source:job.source,source_job_id:job.id,company:job.company,title:job.role,location:job.location,work_mode:job.mode,description:job.whyFit,skills:[...new Set([...(job.matchedSkills||[]),...(job.requirements||[])])],apply_url:job.applyUrl,posted_at:null,fingerprint:fingerprint(job),raw_data:job}));
  if (!rows.length) return { count: 0 };
  const { data, error } = await db.from("jobs").upsert(rows, { onConflict: "fingerprint" }).select("id");
  if (error) throw error;
  return { count: data?.length || 0 };
}
