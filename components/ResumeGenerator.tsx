"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./ResumeGenerator.module.css";

type ResumeRole = "manual-testing" | "software-developer" | "technical-support";

type GeneratedResume = {
  roleLabel: string;
  candidateName: string;
  contactLine: string;
  summary: string;
  sections: Array<{ heading: string; lines: string[] }>;
  warnings: string[];
};

type GenerateResponse = {
  filename: string;
  pdfBase64: string;
  resume: GeneratedResume;
  sourceFileName: string;
  generatedAt: string;
};

const roleOptions: Array<{
  value: ResumeRole;
  title: string;
  subtitle: string;
}> = [
  {
    value: "manual-testing",
    title: "Manual Testing / QA",
    subtitle: "Prioritizes testing, documentation, SQL and QA-relevant evidence already present in your base resume.",
  },
  {
    value: "software-developer",
    title: "Software Developer",
    subtitle: "Prioritizes programming skills, technical projects and software-development evidence from the uploaded resume.",
  },
  {
    value: "technical-support",
    title: "Technical Support",
    subtitle: "Prioritizes support, troubleshooting, communication, documentation and operations-related evidence.",
  },
];

function base64PdfToUrl(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export default function ResumeGenerator() {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<ResumeRole>("manual-testing");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Upload your base resume and choose a target role.");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.session));
      setReady(true);
    });

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function generate() {
    if (!file) {
      setStatus("Choose a PDF, DOCX or TXT base resume first.");
      return;
    }

    setLoading(true);
    setStatus("Reading your base resume and building a role-focused ATS version…");

    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Sign in again.");

      const form = new FormData();
      form.append("resume", file);
      form.append("role", role);

      const response = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = (await response.json()) as GenerateResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Resume generation failed.");

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const nextUrl = base64PdfToUrl(data.pdfBase64);
      setPdfUrl(nextUrl);
      setResult(data);
      setStatus(`${data.resume.roleLabel} resume generated from ${data.sourceFileName}. Review it before applying.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Resume generation failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !signedIn) return null;

  return (
    <section className={styles.shell} aria-label="Resume generator">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}><Sparkles size={14} /> AI-MAD Resume Studio</span>
            <h2>Generate a resume for each target role</h2>
            <p>
              Upload one base resume, choose the role, and VIP-Hunter creates a clean ATS-friendly PDF while keeping the content grounded in your uploaded resume.
            </p>
          </div>
          <span className={styles.badge}><ShieldCheck size={14} /> No invented skills</span>
        </div>

        <div className={styles.roles}>
          {roleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.roleCard} ${role === option.value ? styles.active : ""}`}
              onClick={() => setRole(option.value)}
            >
              <span className={styles.radio}>{role === option.value ? <CheckCircle2 size={18} /> : null}</span>
              <strong>{option.title}</strong>
              <small>{option.subtitle}</small>
            </button>
          ))}
        </div>

        <div className={styles.uploadRow}>
          <label className={styles.uploadBox}>
            <UploadCloud size={22} />
            <span>
              <b>{file ? file.name : "Upload base resume"}</b>
              <small>PDF, DOCX or TXT · maximum 8 MB</small>
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf,.docx,text/plain,.txt"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setFile(selected);
                setResult(null);
                if (selected) setStatus(`${selected.name} ready. Choose a role and generate.`);
              }}
            />
          </label>

          <button className={styles.generate} type="button" onClick={generate} disabled={loading || !file}>
            {loading ? <LoaderCircle className={styles.spin} size={18} /> : <FileText size={18} />}
            {loading ? "Generating…" : "Generate resume"}
          </button>
        </div>

        <div className={styles.status}>{status}</div>

        {result && (
          <div className={styles.resultGrid}>
            <article className={styles.preview}>
              <header>
                <div>
                  <h3>{result.resume.candidateName}</h3>
                  <strong>{result.resume.roleLabel}</strong>
                  {result.resume.contactLine && <p>{result.resume.contactLine}</p>}
                </div>
                {pdfUrl && (
                  <a href={pdfUrl} download={result.filename} className={styles.download}>
                    <Download size={16} /> Download PDF
                  </a>
                )}
              </header>

              <section>
                <h4>SUMMARY</h4>
                <p>{result.resume.summary}</p>
              </section>

              {result.resume.sections.map((section) => (
                <section key={section.heading}>
                  <h4>{section.heading}</h4>
                  <ul>
                    {section.lines.slice(0, 12).map((line, index) => (
                      <li key={`${section.heading}-${index}`}>{line.replace(/^[-*]\s*/, "")}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>

            <aside className={styles.side}>
              <div className={styles.sideCard}>
                <b>What VIP-Hunter changes</b>
                <p>It creates a consistent single-column ATS layout, adds your selected target-role heading, and reorders existing evidence so the most relevant material appears first.</p>
              </div>
              <div className={styles.sideCard}>
                <b>What it does not change</b>
                <p>It does not invent tools, certifications, employers, dates, projects or experience that were not found in the base resume.</p>
              </div>
              {result.resume.warnings.length > 0 && (
                <div className={`${styles.sideCard} ${styles.warning}`}>
                  <b>Review before applying</b>
                  {result.resume.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              )}
              <div className={styles.sideCard}>
                <b>Use with Auto Apply</b>
                <p>Download the generated PDF and select that file in VIP-Hunter Apply Assistant when you want the role-specific version uploaded to ATS applications.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
