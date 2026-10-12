"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ListFilter,
  ChevronDown,
  Compass,
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
const statusLabels: Record<AppStatus, string> = {
  new: "Not applied yet",
  applied: "Application submitted",
  action_required: "Needs my action",
  assessment: "Assessment",
  interview: "Interview",
  rejected: "Not selected",
  offer: "Offer received",
};
type SortOrder = "best" | "newest" | "company";

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
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState<SortOrder>("best");
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [showHelp, setShowHelp] = useState(false);
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

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return jobs
      .filter((job) => filter === "All" || job.type === filter)
      .filter((job) => !onlySaved || saved.includes(job.id))
      .filter((job) => `${job.company} ${job.role} ${job.location} ${(job.requirements || []).join(" ")}`.toLowerCase().includes(term))
      .sort((a, b) => {
        if (sort === "company") return a.company.localeCompare(b.company);
        if (sort === "newest") {
          const aTime = Date.parse(a.posted);
          const bTime = Date.parse(b.posted);
          if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
        }
        return b.fit - a.fit;
      });
  }, [jobs, filter, query, onlySaved, saved, sort]);

  const resultJobs = visible.slice(0, visibleLimit);
  const appliedCount = Object.values(apps).filter(v => v === "applied").length;
  const nextAction = jobs.length === 0
    ? { title: "Find your first matches", details: "Run a job scan to find openings suited to your profile.", target: "#scan", action: "Find jobs" }
    : saved.length === 0
      ? { title: "Create your shortlist", details: "Open the matches below and bookmark roles you want to apply for.", target: "#jobs", action: "View matches" }
      : { title: "Make your next application", details: "Open a saved job, review its requirements and use a tailored resume.", target: "#jobs", action: "Go to my jobs" };

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
    if (error) {
      setSaved((current) => isSaved ? [...current, id] : current.filter((item) => item !== id));
      setStatus(`Couldn't update saved jobs: ${error.message}`);
    } else {
      setStatus(isSaved ? "Removed from saved jobs." : "Job saved to your shortlist.");
    }
  }

  async function setApp(id: string, value: AppStatus) {
    if (!profileId) return;
    const previous = apps[id] || "new";
    setApps((current) => ({ ...current, [id]: value }));
    const { error } = await sb.from("applications").upsert(
      { user_id: profileId, job_id: id, status: value, applied_at: value === "applied" ? new Date().toISOString() : null },
      { onConflict: "user_id,job_id" },
    );
    if (error) {
      setApps((current) => ({ ...current, [id]: previous }));
      setStatus(`Couldn't save application status: ${error.message}`);
    } else {
      setStatus(`Application status updated: ${statusLabels[value]}.`);
    }
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
      setVisibleLimit(8);
      setAtsJobId(null);
      setStatus((data.jobs?.length || 0) > 0 ? `Scan finished. ${data.jobs.length} matching jobs found.` : "Scan complete. No eligible new matches found yet. Try more job sources below.");
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
    <main className="vh-app" id="overview">
      <div className="vh-wrap">
        <header className="vh-header">
          <a className="vh-brand" href="#overview" aria-label="VIP-Hunter overview">
            <span className="vh-brand-icon"><BriefcaseBusiness size={22} /></span>
            <span><b>VIP<span>Hunter</span></b><small>by AI × MAD Studio</small></span>
          </a>
          <nav className="vh-nav" aria-label="Sections">
            <a href="#overview" className="vh-active">Overview</a>
            <a href="#jobs">Job matches</a>
            <a href="#discover">Explore</a>
            <a href="#resume">Resume studio</a>
            <a href="#applications">Apply assistant</a>
          </nav>
          <div className="vh-account">
            <span className="vh-avatar" aria-hidden="true">{email.trim().slice(0,1).toUpperCase() || "V"}</span>
            <button type="button" onClick={() => sb.auth.signOut()} aria-label="Sign out"><LogOut size={17} /><span>Sign out</span></button>
          </div>
        </header>

        <section className="vh-hero" aria-labelledby="vh-heading">
          <div className="vh-hero-copy">
            <span className="vh-eyebrow"><span className="vh-live" /> YOUR PRIVATE CAREER COMMAND CENTER</span>
            <h1 id="vh-heading">Your next big move <span>starts here.</span></h1>
            <p>Find roles that fit your skills, create ATS-ready resumes, and organize your job search in one beautiful workspace.</p>
            <div className="vh-hero-actions">
              <a href="#jobs" className="vh-primary">Explore matches <ArrowRight size={17}/></a>
              <a href="#resume" className="vh-outline"><FileText size={17}/> Create a resume</a>
            </div>
            <div className="vh-hero-detail"><ShieldCheck size={15}/> Private dashboard <span>·</span> <MapPin size={15}/> Tamil Nadu, Kerala & Bengaluru</div>
          </div>
          <div className="vh-orbit-area" aria-hidden="true">
            <div className="vh-orbit vh-orbit-one"/><div className="vh-orbit vh-orbit-two"/>
            <div className="vh-orbit-center"><BriefcaseBusiness size={52} strokeWidth={1.6}/></div>
            <div className="vh-floating vh-float-top"><Sparkles size={16}/> Smart job matches <CheckCircle2 size={15}/></div>
            <div className="vh-floating vh-float-bottom"><FileText size={16}/> ATS resume builder <CheckCircle2 size={15}/></div>
          </div>
        </section>

        <div className="vh-content">
          <section className="vh-guide" aria-label="Getting started">
            <div className="vh-guide-top">
              <span className="vh-guide-kicker"><Compass size={16}/> YOUR NEXT STEP</span>
              <button type="button" className="vh-help-toggle" aria-expanded={showHelp} onClick={() => setShowHelp(v => !v)}>{showHelp ? "Hide guide" : "How it works"} <ChevronDown size={15}/></button>
            </div>
            <div className="vh-guide-main">
              <span className="vh-guide-icon"><Sparkles size={24}/></span>
              <div><h2>{nextAction.title}</h2><p>{nextAction.details}</p></div>
              <a className="vh-guide-cta" href={nextAction.target}>{nextAction.action} <ArrowRight size={16}/></a>
            </div>
            {showHelp && <div className="vh-walkthrough">
              <div><b>1. Find a job</b><span>Tap “Scan new jobs” or browse other job sources.</span></div>
              <div><b>2. Save and prepare</b><span>Bookmark promising roles and build a resume suited to the job.</span></div>
              <div><b>3. Apply and track</b><span>Review the application on the employer site, submit it, then update the status here.</span></div>
            </div>}
          </section>
          <section className="vh-stats" aria-label="Job search summary">
            <article className="vh-stat"><span className="vh-stat-icon purple"><BriefcaseBusiness size={21}/></span><div><small>Eligible matches</small><strong>{jobs.length}</strong><span>Opportunities found</span></div></article>
            <article className="vh-stat"><span className="vh-stat-icon blue"><CheckCircle2 size={21}/></span><div><small>Applied</small><strong>{appliedCount}</strong><span>Applications sent</span></div></article>
            <article className="vh-stat"><span className="vh-stat-icon pink"><Bookmark size={21}/></span><div><small>Saved roles</small><strong>{saved.length}</strong><span>Your shortlist</span></div></article>
            <article className="vh-stat"><span className="vh-stat-icon orange"><CalendarDays size={21}/></span><div><small>Interviews</small><strong>{Object.values(apps).filter(v => v === "interview").length}</strong><span>In progress</span></div></article>
          </section>

          <section id="scan" className="vh-scan" aria-label="Refresh job matches">
            <span className="vh-scan-icon"><RefreshCw size={23}/></span>
            <div className="vh-scan-text"><div><b>Ready for new opportunities?</b><span className="vh-online"><span/> On-demand scan</span></div><p>Refresh your matches from supported job sources.</p><small role="status" aria-live="polite">{status}</small></div>
            <button type="button" disabled={loading} onClick={refresh}>{loading ? <LoaderCircle className="spin" size={17}/> : <RefreshCw size={17}/>} {loading ? "Scanning…" : "Scan new jobs"}</button>
          </section>

          <section id="jobs" className="vh-results" aria-labelledby="vh-jobs-title">
            <div className="vh-section-title"><div><span><Sparkles size={14}/> CURATED FOR YOU</span><h2 id="vh-jobs-title">Discover your matches <em>{visible.length}</em></h2><p>Relevant roles in QA, development and IT support, ranked by profile fit.</p></div><a href="#discover">More job sources <ArrowRight size={16}/></a></div>
            <div className="vh-toolbar">
              <label className="vh-search"><Search size={18}/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setVisibleLimit(8); }} placeholder="Search job title, company, or city" aria-label="Search jobs" /></label>
              <div className="vh-filters" role="group" aria-label="Job category">
                {(["All", "Testing", "Developer", "System"] as Filter[]).map(f => <button type="button" key={f} className={filter === f ? "selected" : ""} aria-pressed={filter === f} onClick={() => { setFilter(f); setVisibleLimit(8); }}>{f === "All" ? "All jobs" : f === "Testing" ? "QA / Testing" : f === "System" ? "IT Support" : "Developer"}</button>)}
              </div>
            </div>
            <div className="vh-job-preferences">
              <button className={onlySaved ? "vh-saved-filter selected" : "vh-saved-filter"} type="button" aria-pressed={onlySaved} onClick={() => {setOnlySaved(v=>!v);setVisibleLimit(8);}}><Bookmark size={16}/> Saved jobs only <span>{saved.length}</span></button>
              <label className="vh-sort-label"><ListFilter size={16}/> Sort by <select aria-label="Sort job results" value={sort} onChange={e => {setSort(e.target.value as SortOrder); setVisibleLimit(8);}}><option value="best">Best match</option><option value="newest">Most recent</option><option value="company">Company A–Z</option></select></label>
              <span className="vh-results-count" aria-live="polite">Showing {resultJobs.length} of {visible.length}</span>
            </div>

            {visible.length ? <div className="vh-jobs">
              {resultJobs.map(job => (
                <article className="vh-job-card" key={job.id}>
                  <header className="vh-job-heading">
                    <span className="vh-company-mark">{job.company?.charAt(0).toUpperCase() || "J"}</span>
                    <div className="vh-job-heading-text"><span>{job.company}</span><h3>{job.role}</h3></div>
                    <button type="button" className={saved.includes(job.id) ? "vh-save selected" : "vh-save"} aria-label={saved.includes(job.id) ? "Remove saved job" : "Save job"} aria-pressed={saved.includes(job.id)} disabled={!profileId} onClick={() => toggle(job.id)}>{saved.includes(job.id) ? <BookmarkCheck size={20}/> : <Bookmark size={20}/>}</button>
                  </header>
                  <div className="vh-job-meta"><span><MapPin size={14}/>{job.location}</span><span><BriefcaseBusiness size={14}/>{job.experience}</span><span><Clock3 size={14}/>{job.mode}</span></div>
                  <div className="vh-job-labels"><span>{job.type === "Testing" ? "QA / Testing" : job.type === "System" ? "IT Support" : "Development"}</span>{job.salary && <span className="salary">{job.salary}</span>}{job.source && <span>{job.source}</span>}</div>
                  <div className="vh-match"><div><span><Sparkles size={14}/> Profile match</span><b>{job.fit}%</b></div><div className="vh-match-track"><span style={{width: `${Math.max(0,Math.min(100,job.fit))}%`}}/></div></div>
                  {(job.matchedSkills || []).length > 0 && <div className="vh-skills">{job.matchedSkills.slice(0,4).map(skill => <span key={skill}><CheckCircle2 size={12}/>{skill}</span>)}{job.matchedSkills.length > 4 && <span>+{job.matchedSkills.length - 4} more</span>}</div>}
                  {(job.missingSkills || []).length > 0 && <p className="vh-gaps"><AlertCircle size={15}/><span><b>Skills to review:</b> {job.missingSkills.join(", ")}</span></p>}
                  <p className="vh-why">{job.whyFit}</p>
                  <div className="vh-job-bottom">
                    <label>Application status<select value={apps[job.id] || "new"} onChange={e => setApp(job.id,e.target.value as AppStatus)} disabled={!profileId} aria-label={`Application status for ${job.role}`}>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
                    <div className="vh-actions">
                      <button type="button" className="auto-apply-job-button" onClick={() => autoApply(job)}><Play size={14}/> Get apply help</button>
                      <button type="button" className="ats-resume-button" onClick={() => setAtsJobId(v => v === job.id ? null : job.id)} aria-expanded={atsJobId === job.id}><FileText size={14}/> {atsJobId === job.id ? "Close resume" : "ATS resume"}</button>
                      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.role} application on employer website`}>Job site <ExternalLink size={14}/></a>
                    </div>
                  </div>
                  {atsJobId === job.id && <JobAtsGenerator job={job} onClose={() => setAtsJobId(null)}/>}
                </article>
              ))}
            </div> : <div className="vh-empty"><div><Search size={28}/></div><h3>{jobs.length ? (onlySaved ? "No saved jobs match these filters" : "No jobs match your search") : "No matches loaded yet"}</h3><p>{jobs.length ? "Try a broader search or turn off saved jobs only." : "Run a job scan to find your first opportunities."}</p><button type="button" onClick={() => {setQuery("");setFilter("All");setOnlySaved(false);setVisibleLimit(8);}}>Clear filters</button><button type="button" onClick={refresh} disabled={loading}>{loading ? "Scanning…" : "Scan jobs"}</button></div>}
            {visible.length > visibleLimit && <div className="vh-load-more"><button type="button" onClick={() => setVisibleLimit(n=>n+8)}>Show 8 more jobs <ChevronDown size={18}/></button><span>{visible.length - visibleLimit} more matches available</span></div>}
          </section>
          <div className="vh-footnote"><ShieldCheck size={16}/> Match scores are estimates. Check each job description before applying. Application statuses are updated by you or the supported desktop helper.</div>
        </div>
      </div>
      <nav className="vh-mobile-tabs" aria-label="Quick navigation">
        <a href="#overview"><Compass size={19}/><span>Home</span></a>
        <a href="#jobs"><Search size={19}/><span>Jobs</span></a>
        <a href="#discover"><BriefcaseBusiness size={19}/><span>Explore</span></a>
        <a href="#resume"><FileText size={19}/><span>Resume</span></a>
        <a href="#applications"><CheckCircle2 size={19}/><span>Apply</span></a>
      </nav>
    </main>
  );
}
