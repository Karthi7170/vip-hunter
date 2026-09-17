"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Job, JobType } from "@/lib/jobs";

type Filter = "All" | JobType;
type AuthMode = "login" | "setup";
type AppStatus =
  | "new"
  | "applied"
  | "action_required"
  | "assessment"
  | "interview"
  | "rejected"
  | "offer";

const statuses: AppStatus[] = [
  "new",
  "applied",
  "action_required",
  "assessment",
  "interview",
  "rejected",
  "offer",
];

function fromDb(x: any): Job {
  return {
    id: x.id,
    company: x.company,
    role: x.title,
    location: x.location || "Not disclosed",
    experience:
      [x.experience_min, x.experience_max].filter((v: any) => v != null).join("–") +
      (x.experience_min != null ? " yr" : ""),
    mode: x.work_mode || "Not disclosed",
    type: (x.raw_data?.type || "Testing") as JobType,
    fit: Number(x.match_score || x.raw_data?.fit || 0),
    posted: x.posted_at ? new Date(x.posted_at).toLocaleString() : "Recently",
    salary: x.salary_min_lpa
      ? `₹${x.salary_min_lpa}${x.salary_max_lpa ? `–${x.salary_max_lpa}` : ""} LPA`
      : undefined,
    matchedSkills: x.matched_skills || x.raw_data?.matchedSkills || [],
    missingSkills: x.missing_skills || x.raw_data?.missingSkills || [],
    requirements: x.skills || [],
    whyFit: x.match_reason || x.raw_data?.whyFit || "Matched to your VIP-Hunter profile.",
    applyUrl: x.apply_url,
    source: x.source,
  };
}

export default function JobDashboard({ jobs: initialJobs }: { jobs: Job[] }) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [apps, setApps] = useState<Record<string, AppStatus>>({});
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading…");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (alive) {
        setUserId(session?.user.id || null);
        setEmail(session?.user.email || "");
        setAuthLoading(false);
      }
    })();

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id || null);
      setEmail(session?.user.email || "");
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
      let { data: profile } = await sb
        .from("user_profiles")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!profile) {
        const { data: userData } = await sb.auth.getUser();
        const insertResult = await sb
          .from("user_profiles")
          .insert({
            auth_user_id: userId,
            full_name:
              userData.user?.user_metadata?.full_name ||
              userData.user?.email?.split("@")[0] ||
              "VIP-Hunter User",
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
          .limit(50),
        sb.from("saved_jobs").select("job_id").eq("user_id", profile.id),
        sb.from("applications").select("job_id,status").eq("user_id", profile.id),
      ]);

      if (matches.data?.length) {
        setJobs(matches.data.map((row: any) => fromDb({ ...row.jobs, ...row })));
      }
      setSaved((savedJobs.data || []).map((row: any) => row.job_id));
      setApps(
        Object.fromEntries((applications.data || []).map((row: any) => [row.job_id, row.status])),
      );
      setStatus(`${matches.data?.length || 0} database matches loaded`);
    })();
  }, [userId, sb]);

  const visible = useMemo(
    () =>
      jobs
        .filter((job) => filter === "All" || job.type === filter)
        .filter((job) =>
          `${job.company} ${job.role} ${job.location} ${job.requirements.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => b.fit - a.fit),
    [jobs, filter, query],
  );

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus("Signing in…");

    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setStatus(`Sign-in error: ${error.message}`);
      return;
    }

    setStatus("Signed in successfully.");
  }

  async function setupPassword(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    if (!setupPin.trim()) {
      setStatus("Enter your private setup PIN.");
      return;
    }

    setLoading(true);
    setStatus("Creating your password…");

    try {
      const response = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          pin: setupPin,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Password setup failed.");
      }

      setAuthMode("login");
      setConfirmPassword("");
      setSetupPin("");
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
    setSaved((current) => (isSaved ? current.filter((x) => x !== id) : [...current, id]));
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
      {
        user_id: profileId,
        job_id: id,
        status: value,
        applied_at: value === "applied" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,job_id" },
    );
    if (error) setStatus(error.message);
  }

  async function refresh() {
    if (!pin.trim()) {
      setStatus("Enter your private PIN");
      return;
    }

    setLoading(true);
    setStatus("Searching jobs posted in the last 24 hours…");
    try {
      const response = await fetch("/api/jobs/live", {
        method: "POST",
        headers: { "x-app-pin": pin },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setJobs(data.jobs);
      setStatus(`${data.jobs.length} fresh matches found`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="center">
        <LoaderCircle className="spin" /> Opening VIP-Hunter…
      </main>
    );
  }

  if (!userId) {
    const authHasError = /error|failed|invalid|must|match/i.test(status);

    return (
      <main className="auth-page">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />

        <div className="auth-layout">
          <section className="auth-showcase">
            <div className="ai-mad-badge">
              <Sparkles size={16} />
              <strong>AI-MAD</strong>
              <span>Career Intelligence</span>
            </div>

            <div className="auth-brand-block">
              <div className="auth-brand-mark">VH</div>
              <div>
                <b>VIP-Hunter</b>
                <small>powered by AI-MAD</small>
              </div>
            </div>

            <div className="auth-copy">
              <p className="auth-eyebrow">PRIVATE AI JOB COMMAND CENTER</p>
              <h1>
                Find better roles.
                <span> Move faster.</span>
              </h1>
              <p>
                One private workspace for AI-matched openings, application tracking and your daily job search across Chennai, Coimbatore and Kerala.
              </p>
            </div>

            <div className="auth-features">
              <div>
                <span className="auth-feature-icon"><Sparkles size={18} /></span>
                <p><b>AI-MAD matching</b><small>Ranks opportunities against your verified profile.</small></p>
              </div>
              <div>
                <span className="auth-feature-icon"><BriefcaseBusiness size={18} /></span>
                <p><b>Fresh job discovery</b><small>Focuses on relevant fresher and 0–1 year roles.</small></p>
              </div>
              <div>
                <span className="auth-feature-icon"><ShieldCheck size={18} /></span>
                <p><b>Private tracking</b><small>Your saved jobs and application status stay synced.</small></p>
              </div>
            </div>

            <div className="auth-showcase-footer">
              <span className="live-dot" /> AI-MAD system ready
            </div>
          </section>

          <section className="auth-panel-wrap">
            <div className="auth-card-new">
              <div className="auth-card-heading">
                <span className="mini-brand">AI-MAD × VIP-Hunter</span>
                <h2>{authMode === "login" ? "Welcome back" : "Create your password"}</h2>
                <p>
                  {authMode === "login"
                    ? "Sign in to open your private job dashboard."
                    : "Set your password once, then use normal sign-in from any device."}
                </p>
              </div>

              <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => {
                    setAuthMode("login");
                    setStatus("Enter your email and password.");
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={authMode === "setup" ? "active" : ""}
                  onClick={() => {
                    setAuthMode("setup");
                    setStatus("Create your password using your private setup PIN.");
                  }}
                >
                  Create password
                </button>
              </div>

              {authMode === "login" ? (
                <form className="auth-form-new" onSubmit={login}>
                  <label>
                    <span>Email address</span>
                    <div className="auth-field">
                      <Mail size={18} />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </label>

                  <label>
                    <span>Password</span>
                    <div className="auth-field">
                      <LockKeyhole size={18} />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                  </label>

                  <button className="auth-primary" type="submit" disabled={loading}>
                    {loading ? <LoaderCircle className="spin" size={18} /> : <>Open dashboard <ArrowRight size={18} /></>}
                  </button>
                </form>
              ) : (
                <form className="auth-form-new" onSubmit={setupPassword}>
                  <label>
                    <span>Email address</span>
                    <div className="auth-field">
                      <Mail size={18} />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </label>

                  <label>
                    <span>Create password</span>
                    <div className="auth-field">
                      <LockKeyhole size={18} />
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                  </label>

                  <label>
                    <span>Confirm password</span>
                    <div className="auth-field">
                      <LockKeyhole size={18} />
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Re-enter your password"
                      />
                    </div>
                  </label>

                  <label>
                    <span>Private setup PIN</span>
                    <div className="auth-field">
                      <KeyRound size={18} />
                      <input
                        type="password"
                        required
                        value={setupPin}
                        onChange={(event) => setSetupPin(event.target.value)}
                        placeholder="Enter your private PIN"
                      />
                    </div>
                  </label>

                  <button className="auth-primary" type="submit" disabled={loading}>
                    {loading ? <LoaderCircle className="spin" size={18} /> : <>Create password <ArrowRight size={18} /></>}
                  </button>

                  <p className="auth-security-note">
                    <ShieldCheck size={16} /> Password setup is handled through your private server route and does not use a magic-link email.
                  </p>
                </form>
              )}

              {status !== "Loading…" && (
                <div className={`auth-status-new ${authHasError ? "error" : ""}`}>{status}</div>
              )}

              <div className="auth-card-footer">
                <ShieldCheck size={15} /> Secure private access · AI-MAD intelligence layer
              </div>
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
          <button onClick={() => sb.auth.signOut()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
        <h1>
          Fresh jobs. <span>Matched to your profile.</span>
        </h1>
        <p>MCA · Fresher/0–1 year · Chennai · Coimbatore · Kerala · WFO · ₹3–4 LPA target</p>
      </section>

      <section className="content">
        <div className="panel run">
          <div>
            <b>24-hour job scan</b>
            <small>{status}</small>
          </div>
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Private app PIN"
          />
          <button onClick={refresh} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Run now
          </button>
        </div>

        <div className="stats">
          <div>
            <b>{jobs.filter((job) => job.fit >= 75).length}</b>
            <span>75%+ matches</span>
          </div>
          <div>
            <b>{Object.values(apps).filter((value) => value === "applied").length}</b>
            <span>Applied</span>
          </div>
          <div>
            <b>{saved.length}</b>
            <span>Saved</span>
          </div>
        </div>

        <div className="tools">
          <label>
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs…" />
          </label>
          <div>
            {(["All", "Testing", "Developer", "System"] as Filter[]).map((value) => (
              <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <h2>
          Latest matches <small>{visible.length} roles</small>
        </h2>

        <div className="jobs">
          {visible.map((job) => (
            <article key={job.id}>
              <div className="score">
                {job.fit}%<small>MATCH</small>
              </div>
              <div className="job">
                <header>
                  <div>
                    <em>{job.company}</em>
                    <h3>{job.role}</h3>
                  </div>
                  <button className="icon" onClick={() => toggle(job.id)}>
                    {saved.includes(job.id) ? <BookmarkCheck /> : <Bookmark />}
                  </button>
                </header>
                <p className="meta">
                  <MapPin size={14} />
                  {job.location} · {job.experience} · {job.mode} · {job.type}
                </p>
                <div className="tags">
                  {job.matchedSkills.map((skill) => (
                    <span key={skill}>✓ {skill}</span>
                  ))}
                </div>
                {job.missingSkills.length > 0 && (
                  <p className="missing">
                    <b>Missing/unverified:</b> {job.missingSkills.join(", ")}
                  </p>
                )}
                <p>{job.whyFit}</p>
                <footer>
                  <select value={apps[job.id] || "new"} onChange={(event) => setApp(job.id, event.target.value as AppStatus)}>
                    {statuses.map((value) => (
                      <option key={value} value={value}>
                        {value.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <a href={job.applyUrl} target="_blank" rel="noreferrer">
                    Apply manually <ExternalLink size={14} />
                  </a>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
