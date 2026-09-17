"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Job, JobType } from "@/lib/jobs";
import JobAtsGenerator from "@/components/JobAtsGenerator";

type Filter = "All" | JobType;
type AuthMode = "login" | "setup";
type AppStatus = "new" | "applied" | "action_required" | "assessment" | "interview" | "rejected" | "offer";

const statuses: AppStatus[] = ["new", "applied", "action_required", "assessment", "interview", "rejected", "offer"];

function fromDb(x: any): Job {
  const min = x.experience_min;
  const max = x.experience_max;
  const experience = min != null
    ? `${min}${max != null && max !== min ? `–${max}` : ""} yr`
    : x.raw_data?.experience || "Not disclosed";

  return {
    id: x.id,
    company: x.company,
    role: x.title,
    location: x.location || "Not disclosed",
    experience,
    mode: x.work_mode || x.raw_data?.mode || "Not disclosed",
    type: (x.raw_data?.type || "Testing") as JobType,
    fit: Number(x.match_score || x.raw_data?.fit || 0),
    posted: x.posted_at ? new Date(x.posted_at).toLocaleString() : x.raw_data?.posted || "Recently",
    salary: x.salary_min_lpa
      ? `₹${x.salary_min_lpa}${x.salary_max_lpa ? `–${x.salary_max_lpa}` : ""} LPA`
      : x.raw_data?.salary,
    matchedSkills: x.matched_skills || x.raw_data?.matchedSkills || [],
    missingSkills: x.missing_skills || x.raw_data?.missingSkills || [],
    requirements: x.skills || x.raw_data?.requirements || [],
    whyFit: x.match_reason || x.raw_data?.whyFit || "Matched to your VIP-Hunter profile.",
    applyUrl: x.apply_url,
    source: x.source,
    jobDescription: x.raw_data?.jobDescription || "",
  };
}

export default function JobDashboard({ jobs: initialJobs }: { jobs: Job[] }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [apps, setApps] = useState<Record<string, AppStatus>>({});
  const [atsJobId, setAtsJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading…");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUserId(data.session?.user.id || null);
      setEmail(data.session?.user.email || "");
      setAuthLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setEmail(session?.user.email || "");
      setAuthLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setStatus("Syncing VIP-Hunter…");
      let { data: profile } = await sb.from("user_profiles").select("id").eq("auth_user_id", userId).maybeSingle();

      if (!profile) {
        const { data: userData } = await sb.auth.getUser();
        const insertResult = await sb
          .from("user_profiles")
          .insert({
            auth_user_id: userId,
            full_name: userData.user?.user_metadata?.full_name || userData.user?.email?.split("@")[0] || "VIP-Hunter User",
            email: userData.user?.email,
          })
          .select("id")
          .single();
        profile = insertResult.data;
      }

      if (!profile) {
        setStatus("Profile setup failed");
        return;
      }

      setProfileId(profile.id);
      const [matches, savedJobs, applications] = await Promise.all([
        sb
          .from("job_matches")
          .select("match_score,matched_skills,missing_skills,match_reason,jobs(*)")
          .eq("user_id", profile.id)
          .eq("eligible", true)
          .order("match_score", { ascending: false })
          .limit(200),
        sb.from("saved_jobs").select("job_id").eq("user_id", profile.id),
        sb.from("applications").select("job_id,status").eq("user_id", profile.id),
      ]);

      if (matches.data?.length) setJobs(matches.data.map((row: any) => fromDb({ ...row.jobs, ...row })));
      setSaved((savedJobs.data || []).map((row: any) => row.job_id));
      setApps(Object.fromEntries((applications.data || []).map((row: any) => [row.job_id, row.status])));
      setStatus(`${matches.data?.length || 0} saved statewide matches loaded`);
    })();
  }, [userId, sb]);

  const visible = useMemo(
    () => jobs
      .filter((job) => filter === "All" || job.type === filter)
      .filter((job) => `${job.company} ${job.role} ${job.location} ${job.requirements.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.fit - a.fit),
    [jobs, filter, query],
  );

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("Signing in…");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    setStatus(error ? `Sign-in error: ${error.message}` : "Signed in successfully.");
  }

  async function setupPassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setStatus("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setStatus("Passwords do not match.");

    setLoading(true);
    setStatus("Creating your password…");
    try {
      const response = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Password setup failed.");
      setAuthMode("login");
      setConfirmPassword("");
      setStatus(data.message || "Password created. You can sign in now.");
    } catch (error) {
      setStatus(error instanceof Error ? `Password setup error: ${error.message}` : "Password setup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: string) {
    if (!profileId) return;
    const isSaved = saved.includes(id);
    setSaved((current) => isSaved ? current.filter((item) => item !== id) : [...current, id]);
    const queryResult = isSaved
      ? sb.from("saved_jobs").delete().eq("user_id", profileId).eq("job_id", id)
      : sb.from("saved_jobs").insert({ user_id: profileId, job_id: id });
    const { error } = await queryResult;
    if (error) setStatus(error.message);
  }

  async function setApp(id: string, value: AppStatus) {
    if (!profileId) return;
    setApps((current) => ({ ...current, [id]: value }));
    const { error } = await sb.from("applications").upsert(
      { user_id: profileId, job_id: id, status: value, applied_at: value === "applied" ? new Date().toISOString() : null },
      { onConflict: "user_id,job_id" },
    );
    if (error) setStatus(error.message);
  }

  function autoApply(job: Job) {
    window.dispatchEvent(new CustomEvent("vip-hunter:auto-apply-job", { detail: job }));
  }

  async function refresh() {
    setLoading(true);
    setStatus("Searching the past 7 days across Tamil Nadu, Kerala and Bengaluru…");
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/jobs/live", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setJobs(data.jobs || []);
      setAtsJobId(null);
      setStatus(`${data.jobs?.length || 0} eligible matches found across Tamil Nadu, Kerala and Bengaluru`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return <main className="center"><LoaderCircle className="spin" /> Opening VIP-Hunter…</main>;

  if (!userId) {
    const authHasError = /error|failed|invalid|must|match|already/i.test(status);
    return (
      <main className="auth-page">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <div className="auth-layout">
          <section className="auth-showcase">
            <div className="ai-mad-badge"><Sparkles size={16} /><strong>AI-MAD</strong><span>Career Intelligence</span></div>
            <div className="auth-brand-block"><div className="auth-brand-mark">VH</div><div><b>VIP-Hunter</b><small>powered by AI-MAD</small></div></div>
            <div className="auth-copy">
              <p className="auth-eyebrow">PRIVATE AI JOB COMMAND CENTER</p>
              <h1>Find better roles.<span> Move faster.</span></h1>
              <p>One private workspace for AI-matched openings, ATS resume tailoring and application tracking across Tamil Nadu, Kerala and Bengaluru.</p>
            </div>
            <div className="auth-features">
              <div><span className="auth-feature-icon"><Sparkles size={18} /></span><p><b>JD-aware ATS resumes</b><small>Tailors verified resume evidence to each job description.</small></p></div>
              <div><span className="auth-feature-icon"><BriefcaseBusiness size={18} /></span><p><b>Fresh job discovery</b><small>Focuses on relevant fresher and 0–1 year roles.</small></p></div>
              <div><span className="auth-feature-icon"><ShieldCheck size={18} /></span><p><b>Private tracking</b><small>Your saved jobs and application status stay synced.</small></p></div>
            </div>
          </section>

          <section className="auth-panel-wrap">
            <div className="auth-card-new">
              <div className="auth-card-heading">
                <span className="mini-brand">AI-MAD × VIP-Hunter</span>
                <h2>{authMode === "login" ? "Welcome back" : "Create your password"}</h2>
                <p>{authMode === "login" ? "Sign in to open your private job dashboard." : "Create your password using your VIP-Hunter email."}</p>
              </div>
              <div className="auth-tabs" role="tablist">
                <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setStatus("Enter your email and password."); }}>Sign in</button>
                <button type="button" className={authMode === "setup" ? "active" : ""} onClick={() => { setAuthMode("setup"); setStatus("Enter your email and create a password."); }}>Create password</button>
              </div>

              <form className="auth-form-new" onSubmit={authMode === "login" ? login : setupPassword}>
                <label><span>Email address</span><div className="auth-field"><Mail size={18} /><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
                <label><span>{authMode === "login" ? "Password" : "Create password"}</span><div className="auth-field"><LockKeyhole size={18} /><input type="password" required minLength={authMode === "setup" ? 8 : undefined} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={authMode === "login" ? "Enter your password" : "Minimum 8 characters"} /></div></label>
                {authMode === "setup" && <label><span>Confirm password</span><div className="auth-field"><LockKeyhole size={18} /><input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></div></label>}
                <button className="auth-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <>{authMode === "login" ? "Open dashboard" : "Create password"} <ArrowRight size={18} /></>}</button>
              </form>

              {status !== "Loading…" && <div className={`auth-status-new ${authHasError ? "error" : ""}`}>{status}</div>}
              <div className="auth-card-footer"><ShieldCheck size={15} /> Secure email + password access · AI-MAD intelligence layer</div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="top">
          <b className="brand">VIP-Hunter <span className="brand-ai">AI-MAD</span></b>
          <button onClick={() => sb.auth.signOut()}><LogOut size={16} /> Sign out</button>
        </div>
        <h1>Fresh jobs. <span>Matched to your profile.</span></h1>
        <p>MCA · Fresher/0–1 year · Tamil Nadu — all cities · Kerala — all cities · Bengaluru · WFO priority · ₹3 LPA average target</p>
      </section>

      <section className="content">
        <div className="panel run">
          <div><b>7-day statewide job scan</b><small>{status}</small></div>
          <button onClick={refresh} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Run now</button>
        </div>

        <div className="stats">
          <div><b>{jobs.length}</b><span>All eligible matches</span></div>
          <div><b>{Object.values(apps).filter((value) => value === "applied").length}</b><span>Applied</span></div>
          <div><b>{saved.length}</b><span>Saved</span></div>
        </div>

        <div className="tools">
          <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs…" /></label>
          <div>{(["All", "Testing", "Developer", "System"] as Filter[]).map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div>
        </div>

        <h2>All eligible matches <small>{visible.length} roles</small></h2>

        <div className="jobs">
          {visible.map((job) => (
            <article key={job.id}>
              <div className="score">{job.fit}%<small>MATCH</small></div>
              <div className="job">
                <header>
                  <div><em>{job.company}</em><h3>{job.role}</h3></div>
                  <button className="icon" onClick={() => toggle(job.id)}>{saved.includes(job.id) ? <BookmarkCheck /> : <Bookmark />}</button>
                </header>

                <p className="meta"><MapPin size={14} /> {job.location} · {job.experience} · {job.mode} · {job.type}</p>
                <div className="tags">{job.matchedSkills.map((skill) => <span key={skill}>✓ {skill}</span>)}</div>
                {job.missingSkills.length > 0 && <p className="missing"><b>Missing/unverified:</b> {job.missingSkills.join(", ")}</p>}
                <p>{job.whyFit}</p>

                <footer>
                  <select value={apps[job.id] || "new"} onChange={(event) => setApp(job.id, event.target.value as AppStatus)}>
                    {statuses.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
                  </select>
                  <button type="button" className="auto-apply-job-button" onClick={() => autoApply(job)}>
                    <Play size={14} /> Auto Apply
                  </button>
                  <button type="button" className="ats-resume-button" onClick={() => setAtsJobId((current) => current === job.id ? null : job.id)}>
                    <Sparkles size={14} /> {atsJobId === job.id ? "Close ATS Generator" : "ATS Resume"}
                  </button>
                  <a href={job.applyUrl} target="_blank" rel="noreferrer">Apply manually <ExternalLink size={14} /></a>
                </footer>

                {atsJobId === job.id && <JobAtsGenerator job={job} onClose={() => setAtsJobId(null)} />}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
