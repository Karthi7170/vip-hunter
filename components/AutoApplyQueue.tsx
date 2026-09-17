"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Play, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./AutoApplyQueue.module.css";

type QueueJob = {
  jobId: string;
  company: string;
  title: string;
  location: string;
  applyUrl: string;
  source: string;
  score: number;
  supported: boolean;
};

function supportsAssist(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return [
      "jobs.lever.co",
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
      "jobs.smartrecruiters.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export default function AutoApplyQueue() {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Preparing queue…");

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!active || !auth.user) {
        setReady(true);
        return;
      }

      const { data: profile } = await sb
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();

      if (!active || !profile) {
        setReady(true);
        setMessage("Profile is not ready yet.");
        return;
      }

      setProfileId(profile.id);

      const { data, error } = await sb
        .from("job_matches")
        .select("job_id,match_score,eligible,jobs(id,company,title,location,apply_url,source)")
        .eq("user_id", profile.id)
        .eq("eligible", true)
        .gte("match_score", 75)
        .order("match_score", { ascending: false })
        .limit(25);

      if (!active) return;

      if (error) {
        setMessage(error.message);
        setReady(true);
        return;
      }

      const mapped = (data || []).flatMap((row: any) => {
        const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
        if (!job?.apply_url) return [];
        return [{
          jobId: row.job_id,
          company: job.company || "Company",
          title: job.title || "Role",
          location: job.location || "Not disclosed",
          applyUrl: job.apply_url,
          source: job.source || "Career site",
          score: Number(row.match_score || 0),
          supported: supportsAssist(job.apply_url),
        } satisfies QueueJob];
      });

      setJobs(mapped);
      setMessage(mapped.length ? `${mapped.length} high-fit applications ready` : "No 75%+ jobs are queued yet. Run the 7-day scan first.");
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [sb]);

  async function launch(job: QueueJob) {
    window.open(job.applyUrl, "_blank", "noopener,noreferrer");

    if (!profileId) return;
    await sb.from("applications").upsert(
      {
        user_id: profileId,
        job_id: job.jobId,
        status: "action_required",
        notes: job.supported
          ? "Opened through AI-MAD Apply Assistant. Browser helper can fill supported ATS fields; review before submitting."
          : "Opened for manual completion because this application host is not supported by the browser helper.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" },
    );
  }

  if (!ready) return null;

  return (
    <section className={styles.shell} aria-label="Auto apply queue">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}><Sparkles size={14} /> AI-MAD Apply Assistant</span>
            <h2>Assisted auto-apply queue</h2>
            <p>{message}</p>
          </div>
          <span className={styles.badge}>Review before submit</span>
        </div>

        <div className={styles.notice}>
          <ShieldCheck size={17} />
          <span>
            VIP-Hunter can prepare and open applications. The optional browser helper can fill common fields on supported public ATS forms. It never solves CAPTCHA/OTP, bypasses logins, invents answers, or clicks the final submit button for you.
          </span>
        </div>

        {jobs.length > 0 && (
          <div className={styles.queue}>
            {jobs.map((job) => (
              <article key={job.jobId} className={styles.card}>
                <div className={styles.score}>{job.score}%</div>
                <div className={styles.info}>
                  <b>{job.title}</b>
                  <span>{job.company} · {job.location}</span>
                  <small>{job.source}</small>
                </div>
                <div className={styles.actions}>
                  <span className={job.supported ? styles.supported : styles.manual}>
                    {job.supported ? "Autofill supported" : "Manual form"}
                  </span>
                  <button onClick={() => launch(job)}>
                    {job.supported ? <Play size={15} /> : <ExternalLink size={15} />}
                    {job.supported ? "Start assisted apply" : "Open application"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <TriangleAlert size={15} /> LinkedIn, Naukri and Indeed remain discovery/manual-apply sources unless you use an officially supported integration. VIP-Hunter does not run account scraping or prohibited submit bots on those sites.
        </div>
      </div>
    </section>
  );
}
