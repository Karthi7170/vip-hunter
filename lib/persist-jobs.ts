import { createHash } from "node:crypto";
import type { Job } from "@/lib/jobs";
import { createAdminSupabase } from "@/lib/supabase-admin";

const fingerprint = (job: Job) =>
  createHash("sha256")
    .update(`${job.company}|${job.role}|${job.location}|${job.applyUrl}`.toLowerCase())
    .digest("hex");

export async function persistJobs(jobs: Job[], profileId?: string) {
  const db = createAdminSupabase();

  const rows = jobs.map((job) => ({
    source: job.source,
    source_job_id: job.id,
    company: job.company,
    title: job.role,
    location: job.location,
    work_mode: job.mode,
    description: job.whyFit,
    skills: [...new Set([...(job.matchedSkills || []), ...(job.requirements || [])])],
    apply_url: job.applyUrl,
    posted_at: job.posted ? new Date(job.posted).toISOString() : null,
    fingerprint: fingerprint(job),
    raw_data: job,
  }));

  if (!rows.length) return { count: 0, jobs: [] as Job[] };

  const { data: persistedRows, error } = await db
    .from("jobs")
    .upsert(rows, { onConflict: "fingerprint" })
    .select("id,fingerprint");

  if (error) throw error;

  const idByFingerprint = new Map(
    (persistedRows || []).map((row: { id: string; fingerprint: string }) => [row.fingerprint, row.id]),
  );

  const persistedJobs = jobs
    .map((job) => {
      const id = idByFingerprint.get(fingerprint(job));
      return id ? { ...job, id } : null;
    })
    .filter((job): job is Job => Boolean(job));

  let profileIds: string[] = [];
  if (profileId) {
    profileIds = [profileId];
  } else {
    const { data: profiles, error: profilesError } = await db.from("user_profiles").select("id");
    if (profilesError) throw profilesError;
    profileIds = (profiles || []).map((profile: { id: string }) => profile.id);
  }

  if (profileIds.length && persistedJobs.length) {
    const sourceByDbId = new Map(
      persistedJobs.map((persistedJob) => [
        persistedJob.id,
        jobs.find((sourceJob) => fingerprint(sourceJob) === fingerprint(persistedJob)) || persistedJob,
      ]),
    );

    const matchRows = profileIds.flatMap((userId) =>
      persistedJobs.map((persistedJob) => {
        const sourceJob = sourceByDbId.get(persistedJob.id) || persistedJob;
        return {
          user_id: userId,
          job_id: persistedJob.id,
          match_score: sourceJob.fit,
          matched_skills: sourceJob.matchedSkills || [],
          missing_skills: sourceJob.missingSkills || [],
          match_reason: sourceJob.whyFit,
          eligible: true,
        };
      }),
    );

    const { error: matchError } = await db
      .from("job_matches")
      .upsert(matchRows, { onConflict: "user_id,job_id" });

    if (matchError) throw matchError;
  }

  return { count: persistedJobs.length, jobs: persistedJobs };
}
