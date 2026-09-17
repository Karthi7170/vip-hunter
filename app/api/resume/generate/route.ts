import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createAdminSupabase } from "@/lib/supabase-admin";
import {
  filenameForResume,
  renderResumePdf,
  tailorResume,
  type ResumeRole,
  type TailoredResume,
} from "@/lib/resume-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

const roles = new Set<ResumeRole>([
  "manual-testing",
  "software-developer",
  "technical-support",
]);

const roleTerms: Record<ResumeRole, string[]> = {
  "manual-testing": [
    "manual testing",
    "software testing",
    "test cases",
    "functional testing",
    "regression testing",
    "smoke testing",
    "sanity testing",
    "bug",
    "defect",
    "stlc",
    "sdlc",
    "sql",
    "selenium",
    "java",
    "automation testing",
    "api testing",
    "postman",
    "jira",
  ],
  "software-developer": [
    "html",
    "css",
    "javascript",
    "php",
    "sql",
    "java",
    "python",
    "react",
    "next.js",
    "node.js",
    "frontend",
    "backend",
    "web development",
    "api",
    "database",
    "git",
  ],
  "technical-support": [
    "technical support",
    "system support",
    "it support",
    "troubleshooting",
    "ticketing",
    "windows",
    "linux",
    "networking",
    "tcp/ip",
    "dns",
    "dhcp",
    "active directory",
    "customer support",
    "documentation",
    "communication",
    "incident",
    "service desk",
    "help desk",
  ],
};

const jdDictionary = [
  "manual testing",
  "software testing",
  "automation testing",
  "test cases",
  "functional testing",
  "regression testing",
  "smoke testing",
  "sanity testing",
  "api testing",
  "selenium",
  "postman",
  "jira",
  "stlc",
  "sdlc",
  "bug",
  "defect",
  "sql",
  "java",
  "core java",
  "html",
  "css",
  "javascript",
  "php",
  "python",
  "react",
  "next.js",
  "node.js",
  "git",
  "github",
  "frontend",
  "backend",
  "database",
  "web development",
  "technical support",
  "system support",
  "it support",
  "customer support",
  "troubleshooting",
  "ticketing",
  "service desk",
  "help desk",
  "windows",
  "linux",
  "networking",
  "tcp/ip",
  "dns",
  "dhcp",
  "active directory",
  "incident management",
  "documentation",
  "communication",
  "ms office",
  "excel",
  "data entry",
  "problem solving",
  "teamwork",
  "adaptability",
];

const stopWords = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "our", "are", "will", "have", "has", "had", "into", "about", "who", "job", "role", "work", "working", "candidate", "candidates", "responsibilities", "responsibility", "requirements", "required", "preferred", "skills", "skill", "experience", "years", "year", "ability", "knowledge", "good", "strong", "excellent", "team", "teams", "using", "use", "support", "including", "other", "such", "any", "all", "within", "across", "their", "they", "them", "must", "should", "would", "can", "may", "day", "business", "company", "position", "looking", "seeking", "etc",
]);

async function extractText(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const result = await pdfParse(bytes);
    return result.text || "";
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value || "";
  }

  if (type.startsWith("text/") || name.endsWith(".txt")) {
    return bytes.toString("utf8");
  }

  throw new Error("Upload a PDF, DOCX, or TXT base resume.");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9+.#/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTerm(text: string, term: string) {
  const haystack = ` ${normalize(text)} `;
  const needle = ` ${normalize(term)} `;
  return haystack.includes(needle) || (term.length >= 5 && haystack.includes(normalize(term)));
}

function fallbackJdKeywords(jobDescription: string) {
  const words = normalize(jobDescription)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word) && !/^\d+$/.test(word));
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([word]) => word);
}

function extractJdKeywords(jobDescription: string) {
  const detected = jdDictionary.filter((term) => hasTerm(jobDescription, term));
  const fallback = fallbackJdKeywords(jobDescription);
  return [...new Set([...detected, ...fallback])].slice(0, 24);
}

function scoreContact(resume: TailoredResume) {
  let points = 0;
  const contact = resume.contactLine || "";
  if (resume.candidateName && resume.candidateName !== "Candidate") points += 25;
  if (/@/.test(contact)) points += 25;
  if (/\b[6-9]\d{9}\b/.test(contact)) points += 25;
  if (/linkedin\.com\/in\//i.test(contact) || /github\.com\//i.test(contact) || /portfolio/i.test(contact)) points += 15;
  if (/chennai|coimbatore|kerala|tamil nadu|india/i.test(contact)) points += 10;
  return Math.min(100, points);
}

function scoreStructure(resume: TailoredResume) {
  const headings = new Set(resume.sections.map((section) => section.heading));
  const checks = [
    Boolean(resume.summary && resume.summary.length >= 50),
    headings.has("SKILLS"),
    headings.has("EDUCATION"),
    headings.has("EXPERIENCE") || headings.has("PROJECTS"),
    resume.sections.every((section) => section.lines.length > 0),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function scoreRoleEvidence(resume: TailoredResume, role: ResumeRole) {
  const text = resume.plainText;
  const matches = roleTerms[role].filter((term) => hasTerm(text, term));
  const target = role === "manual-testing" ? 7 : 6;
  return {
    score: Math.min(100, Math.round((matches.length / target) * 100)),
    matched: matches,
  };
}

function scoreContent(resume: TailoredResume) {
  const text = resume.plainText;
  let score = 30;
  if (resume.sections.some((section) => section.heading === "EXPERIENCE" && section.lines.length >= 2)) score += 20;
  if (resume.sections.some((section) => section.heading === "PROJECTS" && section.lines.length >= 1)) score += 20;
  if (/\b\d+(?:\.\d+)?%|\bcgpa\b|\b\d+\s*months?\b/i.test(text)) score += 10;
  if (/\b(developed|built|handled|maintained|supported|coordinated|executed|resolved|created|implemented|tested|managed)\b/i.test(text)) score += 10;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 180 && wordCount <= 850) score += 10;
  return Math.min(100, score);
}

function scoreKeywordMatch(resume: TailoredResume, jobDescription: string) {
  const keywords = extractJdKeywords(jobDescription);
  if (!keywords.length) return { score: 0, matched: [] as string[], missing: [] as string[] };
  const matched = keywords.filter((keyword) => hasTerm(resume.plainText, keyword));
  const missing = keywords.filter((keyword) => !hasTerm(resume.plainText, keyword));
  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matched,
    missing,
  };
}

function calculateAtsScore(resume: TailoredResume, role: ResumeRole, jobDescription: string) {
  const contact = scoreContact(resume);
  const structure = scoreStructure(resume);
  const roleEvidence = scoreRoleEvidence(resume, role);
  const content = scoreContent(resume);
  const jd = jobDescription.trim();
  const keyword = jd ? scoreKeywordMatch(resume, jd) : null;

  const components = keyword
    ? [
        { key: "keyword-match", label: "Job-description keyword coverage", score: keyword.score, weight: 45 },
        { key: "role-evidence", label: "Role-relevant evidence", score: roleEvidence.score, weight: 20 },
        { key: "structure", label: "ATS structure & sections", score: structure, weight: 15 },
        { key: "contact", label: "Contact completeness", score: contact, weight: 10 },
        { key: "content", label: "Content quality", score: content, weight: 10 },
      ]
    : [
        { key: "role-evidence", label: "Role-relevant evidence", score: roleEvidence.score, weight: 35 },
        { key: "structure", label: "ATS structure & sections", score: structure, weight: 30 },
        { key: "contact", label: "Contact completeness", score: contact, weight: 15 },
        { key: "content", label: "Content quality", score: content, weight: 20 },
      ];

  const overall = Math.round(
    components.reduce((total, component) => total + component.score * (component.weight / 100), 0),
  );

  const notes: string[] = [];
  if (structure < 80) notes.push("Some standard ATS sections are missing or too sparse.");
  if (contact < 80) notes.push("Improve contact details so recruiters and ATS parsers can identify the candidate reliably.");
  if (roleEvidence.score < 65) notes.push("The uploaded resume contains limited verified evidence for the selected target role.");
  if (keyword && keyword.score < 65) notes.push("The generated resume is missing several important terms from the supplied job description.");
  if (content < 70) notes.push("Add measurable outcomes or stronger project/work evidence when those facts are genuinely available.");
  if (!notes.length) notes.push("No major ATS-readiness issue was detected by VIP-Hunter's deterministic checks.");

  return {
    overall,
    mode: keyword ? "job-match" : "readiness",
    label: keyword ? "ATS Match Score" : "ATS Readiness Score",
    components,
    matchedKeywords: keyword?.matched || roleEvidence.matched,
    missingKeywords: keyword?.missing || [],
    notes,
    disclaimer: keyword
      ? "This is an explainable resume-to-job-description compatibility score. It is not a score returned by a specific employer ATS vendor."
      : "No universal ATS score exists across employers. This readiness score measures parseability, standard sections, contact completeness, role evidence and content quality. Paste a job description for a job-specific match score.",
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Sign in to generate a resume." }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Your session is invalid or expired. Sign in again." },
        { status: 401 },
      );
    }

    const form = await request.formData();
    const file = form.get("resume");
    const role = String(form.get("role") || "") as ResumeRole;
    const jobDescription = String(form.get("jobDescription") || "").slice(0, 20000);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a base resume first." }, { status: 400 });
    }
    if (!roles.has(role)) {
      return NextResponse.json({ error: "Choose a valid target role." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Base resume must be 8 MB or smaller." }, { status: 400 });
    }

    const text = (await extractText(file)).trim();
    if (text.length < 80) {
      return NextResponse.json(
        { error: "Not enough readable resume text was found. Try a text-based PDF or DOCX file." },
        { status: 400 },
      );
    }

    const resume = tailorResume(text, role);
    const atsScore = calculateAtsScore(resume, role, jobDescription);
    const pdfBytes = await renderResumePdf(resume);
    const filename = filenameForResume(resume);

    return NextResponse.json({
      filename,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      resume,
      atsScore,
      sourceFileName: file.name,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume generation failed." },
      { status: 500 },
    );
  }
}