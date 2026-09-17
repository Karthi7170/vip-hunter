"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import {
  loadResumeProfile,
  type ResumeProfile,
} from "@/lib/resume-bank-client";
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
  jobDescription: string;
  resumeProfile: ResumeProfile;
};

type PreparedJob = {
  url: string;
  jobId: string;
  company: string;
  title: string;
  atsScore: number;
  resume: {
    name: string;
    type: string;
    size: number;
    base64: string;
  };
};

function supportsAssist(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return [
      "jobs.lever.co",
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
      "job-boards.eu.greenhouse.io",
      "jobs.smartrecruiters.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function profileForJob(type: string, title: string): ResumeProfile {
  const text = `${type} ${title}`.toLowerCase();
  if (/developer|software engineer|programmer|frontend|backend|full.?stack/.test(text)) return "software-developer";
  if (/system|technical support|it support|service desk|help.?desk|support engineer/.test(text)) return "technical-support";
  return "manual-testing";
}

function profileLabel(profile: ResumeProfile) {
  if (profile === "software-developer") return "Software Developer";
  if (profile === "technical-support") return "Technical Support";
  return "Manual Testing / QA";
}

function estimatedBase64Bytes(base64: string) {
  return Math.max(0, Math.floor((base64.length * 3) / 4));
}

function base64PdfUrl(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

function savePdfForMobile(base64: string, filename: string) {
  const url = base64PdfUrl(base64);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "VIP-Hunter-tailored-resume.pdf";
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function detectMobileApplyMode() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadDesktopMode = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod|Android/i.test(ua) || iPadDesktopMode;
}

export default function AutoApplyQueue() {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [mobileJobId, setMobileJobId] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState(false);
  const [extensionReady, setExtensionReady] = useState(false);
  const [message, setMessage] = useState("Preparing queue…");

  useEffect(() => {
    setMobileMode(detectMobileApplyMode());
  }, []);

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
        .select("job_id,match_score,eligible,jobs(id,company,title,location,apply_url,source,raw_data)")
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
        const raw = job.raw_data || {};
        const type = String(raw.type || "");
        const jd = String(raw.jobDescription || "").trim();
        return [{
          jobId: row.job_id,
          company: job.company || "Company",
          title: job.title || "Role",
          location: job.location || "Not disclosed",
          applyUrl: job.apply_url,
          source: job.source || "Career site",
          score: Number(row.match_score || 0),
          supported: supportsAssist(job.apply_url),
          jobDescription: jd,
          resumeProfile: profileForJob(type, job.title || ""),
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

  useEffect(() => {
    if (mobileMode) return;

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "VIP_HUNTER_EXTENSION") return;

      if (event.data.type === "VIP_EXTENSION_READY") {
        setExtensionReady(true);
        return;
      }

      if (event.data.type === "VIP_PREPARED_QUEUE_STARTED") {
        setMessage(`${event.data.total || 0} JD-tailored application${event.data.total === 1 ? "" : "s"} sent to Auto Apply.`);
        return;
      }

      if (event.data.type === "VIP_QUEUE_STATUS") {
        if (event.data.reason) setMessage(event.data.reason);
        const jobId = String(event.data.jobId || "");
        const resultStatus = event.data.resultStatus;
        if (!profileId || !jobId || !resultStatus) return;

        if (resultStatus === "submitted") {
          void sb.from("applications").upsert(
            {
              user_id: profileId,
              job_id: jobId,
              status: "applied",
              applied_at: new Date().toISOString(),
              notes: "Submitted by VIP-Hunter with a JD-tailored role resume on a supported ATS form.",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,job_id" },
          );
        } else if (resultStatus === "action_required") {
          void sb.from("applications").upsert(
            {
              user_id: profileId,
              job_id: jobId,
              status: "action_required",
              notes: String(event.data.reason || "Application needs review before submission."),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,job_id" },
          );
        }
      }

      if (event.data.type === "VIP_REQUEST_PREPARED_AUTO_APPLY") {
        void prepareAndAutoApply();
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "VIP_HUNTER_WEB", type: "VIP_EXTENSION_PING" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, sb, jobs, mobileMode]);

  async function prepareAndAutoApply(singleJob?: QueueJob) {
    if (preparing || mobileMode) return;
    if (!extensionReady) {
      setMessage("Desktop Auto Apply requires the VIP-Hunter Chrome/Edge browser helper. Install or reload the helper, then try again.");
      return;
    }

    const candidates = (singleJob ? [singleJob] : jobs)
      .filter((job) => job.supported && job.jobDescription.length >= 80)
      .slice(0, 20);

    if (!candidates.length) {
      setMessage("No supported jobs currently include enough JD text for safe automatic resume tailoring.");
      return;
    }

    setPreparing(true);
    setMessage(`Preparing ${candidates.length} JD-tailored resume${candidates.length === 1 ? "" : "s"}…`);

    try {
      const { data: auth } = await sb.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const prepared: PreparedJob[] = [];
      const missingProfiles = new Set<string>();
      let failed = 0;

      for (let index = 0; index < candidates.length; index += 1) {
        const job = candidates[index];
        setMessage(`Tailoring resume ${index + 1}/${candidates.length} for ${job.company} · ${job.title}…`);

        const baseResume = await loadResumeProfile(job.resumeProfile);
        if (!baseResume) {
          missingProfiles.add(profileLabel(job.resumeProfile));
          continue;
        }

        const form = new FormData();
        form.append("resume", baseResume);
        form.append("role", job.resumeProfile);
        form.append("jobDescription", job.jobDescription);
        form.append("jobTitle", job.title);
        form.append("company", job.company);

        try {
          const response = await fetch("/api/resume/job-tailor", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          const payload = await response.json();
          if (!response.ok || !payload?.pdfBase64) {
            failed += 1;
            continue;
          }

          prepared.push({
            url: job.applyUrl,
            jobId: job.jobId,
            company: job.company,
            title: job.title,
            atsScore: Number(payload.ats?.score || 0),
            resume: {
              name: payload.filename || `${job.resumeProfile}-tailored.pdf`,
              type: "application/pdf",
              size: estimatedBase64Bytes(payload.pdfBase64),
              base64: payload.pdfBase64,
            },
          });
        } catch {
          failed += 1;
        }
      }

      if (!prepared.length) {
        const missing = [...missingProfiles];
        setMessage(
          missing.length
            ? `Upload the missing role resume${missing.length === 1 ? "" : "s"} first: ${missing.join(", ")}.`
            : "VIP-Hunter could not prepare a safe JD-tailored application from the current queue.",
        );
        return;
      }

      window.postMessage(
        { source: "VIP_HUNTER_WEB", type: "VIP_START_PREPARED_QUEUE", jobs: prepared },
        window.location.origin,
      );

      const details = [
        `${prepared.length} tailored application${prepared.length === 1 ? "" : "s"} prepared`,
        missingProfiles.size ? `${missingProfiles.size} missing role resume profile${missingProfiles.size === 1 ? "" : "s"}` : "",
        failed ? `${failed} generation failure${failed === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(" · ");
      setMessage(`${details}. Starting supported ATS Auto Apply…`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare the Auto Apply queue.");
    } finally {
      setPreparing(false);
    }
  }

  async function tailorAndOpenMobile(job: QueueJob) {
    if (mobileJobId) return;

    if (job.jobDescription.length < 80) {
      window.open(job.applyUrl, "_blank", "noopener,noreferrer");
      setMessage(`${job.company} application opened. This job did not include enough JD text for automatic tailoring.`);
      if (profileId) {
        await sb.from("applications").upsert(
          {
            user_id: profileId,
            job_id: job.jobId,
            status: "action_required",
            notes: "Opened on mobile without automatic tailoring because the stored job did not include a complete JD.",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,job_id" },
        );
      }
      return;
    }

    const applicationWindow = window.open("about:blank", "_blank");
    setMobileJobId(job.jobId);
    setMessage(`Tailoring your ${profileLabel(job.resumeProfile)} resume for ${job.company}…`);

    try {
      const baseResume = await loadResumeProfile(job.resumeProfile);
      if (!baseResume) {
        applicationWindow?.close();
        throw new Error(`Upload your ${profileLabel(job.resumeProfile)} base resume first from the ATS Resume tool.`);
      }

      const { data: auth } = await sb.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) {
        applicationWindow?.close();
        throw new Error("Your session expired. Sign in again.");
      }

      const form = new FormData();
      form.append("resume", baseResume);
      form.append("role", job.resumeProfile);
      form.append("jobDescription", job.jobDescription);
      form.append("jobTitle", job.title);
      form.append("company", job.company);

      const response = await fetch("/api/resume/job-tailor", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const payload = await response.json();
      if (!response.ok || !payload?.pdfBase64) {
        applicationWindow?.close();
        throw new Error(payload?.error || "Could not generate the JD-tailored resume.");
      }

      const filename = payload.filename || `${job.resumeProfile}-tailored.pdf`;
      savePdfForMobile(payload.pdfBase64, filename);

      if (applicationWindow && !applicationWindow.closed) {
        applicationWindow.location.href = job.applyUrl;
      } else {
        window.open(job.applyUrl, "_blank", "noopener,noreferrer");
      }

      setMessage(`Tailored resume saved for ${job.company} · ATS match ${Number(payload.ats?.score || 0)}/100. The application is open—upload the PDF you just saved.`);

      if (profileId) {
        await sb.from("applications").upsert(
          {
            user_id: profileId,
            job_id: job.jobId,
            status: "action_required",
            notes: `Mobile flow prepared a JD-tailored ${profileLabel(job.resumeProfile)} PDF (ATS match ${Number(payload.ats?.score || 0)}/100) and opened the employer application for manual upload/submission.`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,job_id" },
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare the mobile application.");
    } finally {
      setMobileJobId(null);
    }
  }

  async function launch(job: QueueJob) {
    if (mobileMode) {
      await tailorAndOpenMobile(job);
      return;
    }

    if (job.supported && job.jobDescription.length >= 80) {
      await prepareAndAutoApply(job);
      return;
    }

    window.open(job.applyUrl, "_blank", "noopener,noreferrer");

    if (!profileId) return;
    await sb.from("applications").upsert(
      {
        user_id: profileId,
        job_id: job.jobId,
        status: "action_required",
        notes: job.supported
          ? "Opened for review because a complete JD was unavailable for automatic resume tailoring."
          : "Opened for manual completion because this application host is not supported by the browser helper.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" },
    );
  }

  if (!ready) return null;

  const autoReadyCount = jobs.filter((job) => job.supported && job.jobDescription.length >= 80).length;

  return (
    <section className={styles.shell} aria-label="Auto apply queue">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}><Sparkles size={14} /> AI-MAD Apply Assistant</span>
            <h2>{mobileMode ? "JD-tailored mobile apply" : "JD-tailored auto apply"}</h2>
            <p>{message}</p>
          </div>
          {mobileMode ? (
            <span className={styles.mobileBadge}><Smartphone size={15} /> iPhone / mobile mode</span>
          ) : (
            <button
              className={styles.batchButton}
              type="button"
              onClick={() => void prepareAndAutoApply()}
              disabled={preparing || !autoReadyCount}
            >
              {preparing ? <LoaderCircle className={styles.spin} size={16} /> : <Play size={16} />}
              {preparing ? "Preparing resumes…" : `Tailor + Auto Apply (${autoReadyCount})`}
            </button>
          )}
        </div>

        <div className={styles.notice}>
          <ShieldCheck size={17} />
          <span>
            {mobileMode
              ? "For each job, VIP-Hunter reads the JD, selects the matching role resume, generates the tailored PDF and opens the employer application. On iPhone, upload the saved PDF in the application form and submit manually."
              : "For each supported job, VIP-Hunter reads the JD, selects the matching role-specific base resume, generates a JD-tailored PDF, uploads that exact PDF to the employer ATS, fills only verified answers, and can submit when the form is complete. It pauses for CAPTCHA, OTP/login, legal declarations, assessments, or unknown required fields."}
          </span>
        </div>

        {!mobileMode && !extensionReady && (
          <div className={styles.helperNotice}>
            Desktop Auto Apply needs the VIP-Hunter Chrome/Edge browser helper. Install or reload the helper to enable automatic form filling and resume upload.
          </div>
        )}

        {mobileMode && (
          <div className={styles.mobileNotice}>
            Tap <b>Tailor Resume → Open</b>. VIP-Hunter saves the JD-specific PDF first, then opens the employer application so you can upload that exact resume.
          </div>
        )}

        {jobs.length > 0 && (
          <div className={styles.queue}>
            {jobs.map((job) => {
              const jdReady = job.jobDescription.length >= 80;
              const mobileLoading = mobileJobId === job.jobId;
              return (
                <article key={job.jobId} className={styles.card}>
                  <div className={styles.score}>{job.score}%</div>
                  <div className={styles.info}>
                    <b>{job.title}</b>
                    <span>{job.company} · {job.location}</span>
                    <small>{job.source} · {profileLabel(job.resumeProfile)} resume · {jdReady ? "JD ready" : "JD missing"}</small>
                  </div>
                  <div className={styles.actions}>
                    <span className={(mobileMode && jdReady) || (job.supported && jdReady) ? styles.supported : styles.manual}>
                      {mobileMode
                        ? jdReady ? "Mobile tailor ready" : "JD unavailable"
                        : job.supported && jdReady ? "Tailored auto apply" : job.supported ? "Needs JD" : "Manual form"}
                    </span>
                    <button
                      onClick={() => void launch(job)}
                      disabled={(preparing && job.supported) || Boolean(mobileJobId)}
                    >
                      {mobileLoading ? (
                        <LoaderCircle className={styles.spin} size={15} />
                      ) : mobileMode ? (
                        jdReady ? <Smartphone size={15} /> : <ExternalLink size={15} />
                      ) : job.supported && jdReady ? (
                        <Play size={15} />
                      ) : (
                        <ExternalLink size={15} />
                      )}
                      {mobileLoading
                        ? "Tailoring…"
                        : mobileMode
                          ? jdReady ? "Tailor Resume → Open" : "Open application"
                          : job.supported && jdReady ? "Tailor + apply" : "Open application"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className={styles.footer}>
          <TriangleAlert size={15} /> LinkedIn, Naukri and Indeed remain discovery/manual-apply sources unless an officially supported integration is available. VIP-Hunter does not run prohibited logged-in scraping or submit bots on those sites.
        </div>
      </div>
    </section>
  );
}
