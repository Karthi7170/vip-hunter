"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  LoaderCircle,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Job, JobType } from "@/lib/jobs";

type Filter = "All" | JobType;
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

  async function sendPasswordReset() {
    if (!email.trim()) {
      setStatus("Enter your email first.");
      return;
    }

    setLoading(true);
    setStatus("Sending password setup link…");
    const redirectBase = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${redirectBase}/update-password`,
    });
    setLoading(false);

    if (error) {
      setStatus(`Password setup error: ${error.message}`);
      return;
    }

    setStatus("Password setup link sent. Check your Inbox and Spam folders.");
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
    return (
      <main>
        <section className="hero">
          <b className="brand">VIP-Hunter</b>
          <h1>
            Your private <span>AI job hunter.</span>
          </h1>
          <p>Sign in with your email and password to sync jobs, applications and matches across your devices.</p>
        </section>
        <form className="panel login" onSubmit={login}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Please wait…" : "Sign in"}
          </button>
          <button type="button" className="secondary" onClick={sendPasswordReset} disabled={loading}>
            Set / reset password
          </button>
          {status !== "Loading…" && <small>{status}</small>}
        </form>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <div className="top">
          <b className="brand">VIP-Hunter</b>
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
