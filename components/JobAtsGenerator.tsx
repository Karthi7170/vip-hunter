"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, Sparkles, UploadCloud, X } from "lucide-react";
import type { Job } from "@/lib/jobs";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import {
  loadResumeProfile,
  saveResumeProfile,
  type ResumeProfile,
} from "@/lib/resume-bank-client";
import styles from "./JobAtsGenerator.module.css";

type Props = {
  job: Job;
  onClose: () => void;
};

type AtsResult = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  notes: string[];
};

type GenerateResponse = {
  filename: string;
  pdfBase64: string;
  ats: AtsResult;
  resume: {
    candidateName: string;
    roleLabel: string;
    summary: string;
  };
  error?: string;
};

const resumeProfiles: Array<{ value: ResumeProfile; label: string }> = [
  { value: "manual-testing", label: "Manual Testing / QA" },
  { value: "software-developer", label: "Software Developer" },
  { value: "technical-support", label: "Technical Support" },
];

function roleForJob(job: Job): ResumeProfile {
  if (job.type === "Developer") return "software-developer";
  if (job.type === "System") return "technical-support";
  return "manual-testing";
}

function profileLabel(profile: ResumeProfile) {
  return resumeProfiles.find((item) => item.value === profile)?.label || "Resume";
}

function toPdfUrl(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function JobAtsGenerator({ job, onClose }: Props) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const recommendedProfile = useMemo(() => roleForJob(job), [job]);
  const [selectedProfile, setSelectedProfile] = useState<ResumeProfile>(recommendedProfile);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState(job.jobDescription || "");
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [status, setStatus] = useState(
    job.jobDescription
      ? "Job description loaded automatically. VIP-Hunter is selecting the correct role resume."
      : "This older job does not include the full JD. Paste the job description from the application page.",
  );
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResumeLoading(true);
    setFile(null);
    setResult(null);

    loadResumeProfile(selectedProfile)
      .then((saved) => {
        if (!active) return;
        setFile(saved);
        if (saved) {
          setStatus(`${profileLabel(selectedProfile)} base resume selected automatically: ${saved.name}`);
        } else {
          setStatus(`Upload your ${profileLabel(selectedProfile)} base resume once. VIP-Hunter will remember it on this device and reuse it for matching jobs.`);
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus(`Upload your ${profileLabel(selectedProfile)} base resume to continue.`);
      })
      .finally(() => {
        if (active) setResumeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProfile]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function chooseResume(nextFile: File | null) {
    setResult(null);
    if (!nextFile) {
      setFile(null);
      return;
    }

    setFile(nextFile);
    try {
      await saveResumeProfile(selectedProfile, nextFile);
      setStatus(`${profileLabel(selectedProfile)} base resume saved. This resume will be selected automatically for matching jobs.`);
    } catch {
      setStatus(`${nextFile.name} selected for this job. Your browser could not save it for future use.`);
    }
  }

  async function generate() {
    if (!file) {
      setStatus(`Upload your ${profileLabel(selectedProfile)} base resume first.`);
      return;
    }
    if (jd.trim().length < 80) {
      setStatus("Paste the complete job description before generating the ATS version.");
      return;
    }

    setLoading(true);
    setStatus(`Using your ${profileLabel(selectedProfile)} resume as the base and generating the SKILLS section from this JD while preserving the approved format…`);

    try {
      const { data } = await sb.auth.getSession();
      if (!data.session?.access_token) throw new Error("Your session expired. Sign in again.");

      const form = new FormData();
      form.append("resume", file);
      form.append("role", selectedProfile);
      form.append("jobDescription", jd.trim());
      form.append("jobTitle", job.role);
      form.append("company", job.company);

      const response = await fetch("/api/resume/job-tailor", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        body: form,
      });
      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok) throw new Error(payload.error || "ATS resume generation failed.");

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(toPdfUrl(payload.pdfBase64));
      setResult(payload);
      setStatus(`${profileLabel(selectedProfile)} base selected · JD-first skills generated in the same resume format · ATS match ${payload.ats.score}/100.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "ATS resume generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div>
          <span><Sparkles size={14} /> AI-MAD Job ATS Generator</span>
          <h4>{job.role}</h4>
          <p>{job.company} · {job.location}</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close ATS generator"><X size={17} /></button>
      </div>

      <div className={styles.explain}>
        VIP-Hunter keeps your approved one-page format, section order and alignment unchanged. For each job, the SKILLS section is generated from the JD requirements first, using the same fixed six-skill layout. Summary, experience and project claims continue to use your selected base resume as their factual source.
      </div>

      <div className={styles.profileBox}>
        <div>
          <b>Base resume profile</b>
          <small>Auto-selected from this job: {profileLabel(recommendedProfile)}</small>
        </div>
        <select
          value={selectedProfile}
          onChange={(event) => setSelectedProfile(event.target.value as ResumeProfile)}
          disabled={loading}
        >
          {resumeProfiles.map((profile) => (
            <option key={profile.value} value={profile.value}>{profile.label}</option>
          ))}
        </select>
      </div>

      <label className={styles.jdLabel}>
        <span>Job description</span>
        <textarea
          value={jd}
          onChange={(event) => {
            setJd(event.target.value.slice(0, 30000));
            setResult(null);
          }}
          placeholder="Paste the complete job description here…"
        />
        <small>{jd.length.toLocaleString()} / 30,000 characters {job.jobDescription ? "· loaded from the job feed" : "· paste from the job page"}</small>
      </label>

      <div className={styles.actions}>
        <label className={styles.upload}>
          <UploadCloud size={18} />
          <span>
            {resumeLoading
              ? "Checking saved resume…"
              : file
                ? `${profileLabel(selectedProfile)}: ${file.name}`
                : `Upload ${profileLabel(selectedProfile)} resume`}
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf,.docx,text/plain,.txt"
            disabled={resumeLoading || loading}
            onChange={(event) => void chooseResume(event.target.files?.[0] || null)}
          />
        </label>
        <button className={styles.generate} type="button" onClick={generate} disabled={loading || resumeLoading || !file}>
          {loading ? <LoaderCircle className={styles.spin} size={17} /> : <FileText size={17} />}
          {loading ? "Tailoring…" : "Tailor selected resume"}
        </button>
      </div>

      <div className={styles.status}>{status}</div>

      {result && (
        <div className={styles.result}>
          <div className={styles.score}>
            <strong>{result.ats.score}</strong><span>/100 ATS match</span>
          </div>
          <div className={styles.summary}>
            <b>{result.resume.roleLabel}</b>
            <p>{result.resume.summary}</p>
          </div>
          {pdfUrl && (
            <a className={styles.download} href={pdfUrl} download={result.filename}>
              <Download size={16} /> Download tailored PDF
            </a>
          )}
          {result.ats.matchedKeywords.length > 0 && (
            <div className={styles.keywords}><b>JD keywords in generated resume</b><p>{result.ats.matchedKeywords.join(" · ")}</p></div>
          )}
          {result.ats.missingKeywords.length > 0 && (
            <div className={styles.missing}><b>JD-derived skills added for review</b><p>{result.ats.missingKeywords.join(" · ")}</p><small>These requirements were taken from the JD because they were not found in the selected base resume. Review them for accuracy before using the resume.</small></div>
          )}
        </div>
      )}
    </div>
  );
}
