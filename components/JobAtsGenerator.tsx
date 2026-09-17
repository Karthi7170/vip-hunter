"use client";

import { useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, Sparkles, UploadCloud, X } from "lucide-react";
import type { Job } from "@/lib/jobs";
import { createBrowserSupabase } from "@/lib/supabase-browser";
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

function roleForJob(job: Job) {
  if (job.type === "Developer") return "software-developer";
  if (job.type === "System") return "technical-support";
  return "manual-testing";
}

function toPdfUrl(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function JobAtsGenerator({ job, onClose }: Props) {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState(job.jobDescription || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    job.jobDescription
      ? "Job description loaded automatically. Upload your base resume; its original format will be preserved."
      : "This older job does not include the full JD. Paste the job description from the application page.",
  );
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function generate() {
    if (!file) {
      setStatus("Upload your base resume first.");
      return;
    }
    if (jd.trim().length < 80) {
      setStatus("Paste the complete job description before generating the ATS version.");
      return;
    }

    setLoading(true);
    setStatus("Analysing the JD and updating only JD-relevant content inside your original resume format…");

    try {
      const { data } = await sb.auth.getSession();
      if (!data.session?.access_token) throw new Error("Your session expired. Sign in again.");

      const form = new FormData();
      form.append("resume", file);
      form.append("role", roleForJob(job));
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
      setStatus(`Original format preserved · JD-tailored content ready · ATS match ${payload.ats.score}/100.`);
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
        Your uploaded resume template is locked: same one-page structure, section order and alignment. VIP-Hunter only updates JD-relevant summary, skill priority, experience bullet priority and project priority using facts already present in your base resume. It never invents a skill or experience to raise the score.
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
          <span>{file ? file.name : "Upload base resume"}</span>
          <input
            type="file"
            accept="application/pdf,.pdf,.docx,text/plain,.txt"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setResult(null);
            }}
          />
        </label>
        <button type="button" className={styles.generate} onClick={generate} disabled={loading || !file}>
          {loading ? <LoaderCircle className={styles.spin} size={17} /> : <FileText size={17} />}
          {loading ? "Tailoring…" : "Analyse JD + Generate"}
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
            <div className={styles.keywords}><b>Matched JD keywords</b><p>{result.ats.matchedKeywords.join(" · ")}</p></div>
          )}
          {result.ats.missingKeywords.length > 0 && (
            <div className={styles.missing}><b>Missing / unverified JD keywords</b><p>{result.ats.missingKeywords.join(" · ")}</p><small>Do not add these unless they are genuinely true.</small></div>
          )}
        </div>
      )}
    </div>
  );
}
