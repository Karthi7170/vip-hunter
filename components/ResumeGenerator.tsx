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

type AtsComponent = {
  key: string;
  label: string;
  score: number;
  weight: number;
};

type AtsScore = {
  overall: number;
  mode: "job-match" | "readiness";
  label: string;
  components: AtsComponent[];
  matchedKeywords: string[];
  missingKeywords: string[];
  notes: string[];
  disclaimer: string;
};

type GenerateResponse = {
  filename: string;
  pdfBase64: string;
  resume: GeneratedResume;
  atsScore: AtsScore;
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
  const [jobDescription, setJobDescription] = useState("");
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
    setStatus(
      jobDescription.trim()
        ? "Generating your role-focused resume and comparing it with the job description…"
        : "Generating your role-focused resume and calculating ATS readiness…",
    );

    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Sign in again.");

      const form = new FormData();
      form.append("resume", file);
      form.append("role", role);
      if (jobDescription.trim()) form.append("jobDescription", jobDescription.trim());

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
      setStatus(
        `${data.resume.roleLabel} resume generated · ${data.atsScore.label}: ${data.atsScore.overall}/100. Review it before applying.`,
      );
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
              onClick={() => {
                setRole(option.value);
                setResult(null);
              }}
            >
              <span className={styles.radio}>{role === option.value ? <CheckCircle2 size={18} /> : null}</span>
              <strong>{option.title}</strong>
              <small>{option.subtitle}</small>
            </button>
          ))}
        </div>

        <div className={styles.jdBox}>
          <div className={styles.jdHeader}>
            <div>
              <b>Job description for a job-specific ATS match score</b>
              <small>Optional. Paste the exact JD you plan to apply for.</small>
            </div>
            <span>{jobDescription.trim() ? "JD match mode" : "Readiness mode"}</span>
          </div>
          <textarea
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(event.target.value.slice(0, 20000));
              setResult(null);
            }}
            placeholder="Paste the complete job description here to measure keyword coverage and role alignment. Leave blank for ATS-readiness scoring only."
          />
          <div className={styles.jdFoot}>
            <span>{jobDescription.length.toLocaleString()} / 20,000 characters</span>
            <span>The job description is used for scoring only and is not inserted into your resume.</span>
          </div>
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
            {loading ? "Generating…" : "Generate + ATS score"}
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
              <div className={`${styles.sideCard} ${styles.scoreCard}`}>
                <div className={styles.scoreTop}>
                  <div className={styles.scoreCircle}>
                    <strong>{result.atsScore.overall}</strong>
                    <span>/100</span>
                  </div>
                  <div>
                    <b>{result.atsScore.label}</b>
                    <p>
                      {result.atsScore.mode === "job-match"
                        ? "Calculated against the job description you supplied."
                        : "Calculated from ATS readability and role-readiness checks."}
                    </p>
                  </div>
                </div>

                <div className={styles.breakdown}>
                  {result.atsScore.components.map((component) => (
                    <div key={component.key} className={styles.metric}>
                      <div>
                        <span>{component.label}</span>
                        <b>{component.score}/100</b>
                      </div>
                      <div className={styles.track}>
                        <span style={{ width: `${component.score}%` }} />
                      </div>
                      <small>{component.weight}% of overall score</small>
                    </div>
                  ))}
                </div>

                {result.atsScore.matchedKeywords.length > 0 && (
                  <div className={styles.keywordBlock}>
                    <b>Matched keywords</b>
                    <div className={styles.keywordList}>
                      {result.atsScore.matchedKeywords.slice(0, 14).map((keyword) => (
                        <span className={styles.matchKeyword} key={keyword}>✓ {keyword}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.atsScore.missingKeywords.length > 0 && (
                  <div className={styles.keywordBlock}>
                    <b>JD keywords not found in your generated resume</b>
                    <div className={styles.keywordList}>
                      {result.atsScore.missingKeywords.slice(0, 14).map((keyword) => (
                        <span className={styles.missingKeyword} key={keyword}>{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.scoreNotes}>
                  {result.atsScore.notes.map((note) => <p key={note}>• {note}</p>)}
                </div>
                <p className={styles.disclaimer}>{result.atsScore.disclaimer}</p>
              </div>

              <div className={styles.sideCard}>
                <b>What VIP-Hunter changes</b>
                <p>It creates a consistent single-column ATS layout, adds your selected target-role heading, and reorganizes only verified evidence from the base resume.</p>
              </div>
              <div className={styles.sideCard}>
                <b>Score is not printed on your resume</b>
                <p>The ATS score is analysis for you inside VIP-Hunter. The downloaded PDF stays clean and recruiter-ready.</p>
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