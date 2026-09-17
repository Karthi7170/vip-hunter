import { PDFDocument, StandardFonts } from "pdf-lib";

export type ResumeRole = "manual-testing" | "software-developer" | "technical-support";

export type ResumeSection = {
  heading: string;
  lines: string[];
};

export type TailoredResume = {
  role: ResumeRole;
  roleLabel: string;
  candidateName: string;
  contactLine: string;
  summary: string;
  sections: ResumeSection[];
  plainText: string;
  warnings: string[];
};

const roleLabels: Record<ResumeRole, string> = {
  "manual-testing": "Manual Testing / QA",
  "software-developer": "Software Developer",
  "technical-support": "Technical Support / System Support",
};

const roleKeywords: Record<ResumeRole, Array<[string, RegExp]>> = {
  "manual-testing": [
    ["Manual Testing", /manual test|software testing/i],
    ["Test Cases", /test cases?/i],
    ["Functional Testing", /functional test/i],
    ["Regression Testing", /regression/i],
    ["Smoke / Sanity Testing", /smoke|sanity/i],
    ["Bug / Defect Handling", /bug|defect/i],
    ["SDLC / STLC", /\bsdlc\b|\bstlc\b/i],
    ["SQL", /\bsql\b/i],
    ["Documentation", /documentation|documenting|records/i],
    ["Communication", /communication|student|parent|customer|client/i],
  ],
  "software-developer": [
    ["HTML", /\bhtml5?\b/i],
    ["CSS", /\bcss3?\b/i],
    ["JavaScript", /javascript|\bjs\b/i],
    ["PHP", /\bphp\b/i],
    ["SQL", /\bsql\b/i],
    ["React", /\breact\b/i],
    ["Next.js", /next\.?js/i],
    ["Node.js", /node\.?js/i],
    ["Java", /\bjava\b/i],
    ["Python", /\bpython\b/i],
    ["Web Development", /web app|website|web development|frontend|backend/i],
  ],
  "technical-support": [
    ["Technical Support", /technical support|system support|it support|help desk|service desk/i],
    ["Troubleshooting", /troubleshoot|diagnos|resolve|resolution/i],
    ["Windows", /\bwindows\b/i],
    ["Linux", /\blinux\b/i],
    ["Networking", /networking|tcp\/ip|dns|dhcp/i],
    ["Active Directory", /active directory/i],
    ["Documentation", /documentation|documenting|records/i],
    ["Communication", /communication|student|parent|customer|client/i],
    ["Operations", /operations|coordination|follow[- ]?up|support/i],
    ["MS Office", /microsoft office|ms office|\bexcel\b|\bword\b/i],
  ],
};

const headingMap: Array<[RegExp, string]> = [
  [/^(professional )?summary$|^profile$|^career objective$|^objective$/i, "SUMMARY"],
  [/^(technical )?skills$|^key skills$|^core skills$|^competencies$/i, "SKILLS"],
  [/^(work )?experience$|^professional experience$|^employment$|^work history$/i, "EXPERIENCE"],
  [/^projects?$|^academic projects?$/i, "PROJECTS"],
  [/^education$|^academic qualifications?$|^academics$/i, "EDUCATION"],
  [/^certifications?$|^courses?$|^training$/i, "CERTIFICATIONS"],
  [/^achievements?$|^awards?$/i, "ACHIEVEMENTS"],
  [/^languages?$/i, "LANGUAGES"],
  [/^personal details?$/i, "PERSONAL DETAILS"],
];

function normalizeLine(value: string) {
  return value
    .replace(/[•●▪◦]/g, "-")
    .replace(/[\u00a0\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line, index, all) => index === 0 || line !== all[index - 1]);
}

function detectHeading(line: string) {
  const normalized = line.replace(/[:|]+$/g, "").trim();
  for (const [pattern, heading] of headingMap) {
    if (pattern.test(normalized)) return heading;
  }
  return null;
}

function looksLikeContact(line: string) {
  return /@|\+?\d[\d\s()-]{7,}|linkedin|github|portfolio|chennai|coimbatore|kerala|tamil nadu|india/i.test(line);
}

function looksLikeName(line: string) {
  if (line.length < 3 || line.length > 70) return false;
  if (looksLikeContact(line) || detectHeading(line)) return false;
  const words = line.split(/\s+/);
  return words.length >= 2 && words.length <= 6 && /^[A-Za-z .'-]+$/.test(line);
}

function parseSource(text: string) {
  const lines = cleanLines(text);
  const candidateName = lines.find(looksLikeName) || "Candidate";
  const nameIndex = lines.indexOf(candidateName);
  const contactCandidates = lines
    .slice(Math.max(0, nameIndex + 1), Math.min(lines.length, nameIndex + 7))
    .filter(looksLikeContact)
    .slice(0, 3);

  const sections = new Map<string, string[]>();
  let current = "ADDITIONAL";
  sections.set(current, []);

  for (const line of lines) {
    if (line === candidateName || contactCandidates.includes(line)) continue;
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current)?.push(line);
  }

  return {
    candidateName,
    contactLine: contactCandidates.join(" | "),
    sections,
    sourceText: lines.join("\n"),
  };
}

function roleScore(line: string, role: ResumeRole) {
  return roleKeywords[role].reduce((score, [, pattern]) => score + (pattern.test(line) ? 1 : 0), 0);
}

function stableRoleSort(lines: string[], role: ResumeRole) {
  return lines
    .map((line, index) => ({ line, index, score: roleScore(line, role) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.line);
}

function detectedEvidence(sourceText: string, role: ResumeRole) {
  return roleKeywords[role]
    .filter(([, pattern]) => pattern.test(sourceText))
    .map(([label]) => label)
    .slice(0, 5);
}

function makeSummary(sourceText: string, role: ResumeRole) {
  const evidence = detectedEvidence(sourceText, role);
  const label = roleLabels[role];
  if (evidence.length) {
    return `Candidate targeting entry-level ${label} opportunities. Verified overlap from the uploaded base resume includes ${evidence.join(", ")}. This version prioritizes relevant experience, projects and skills without adding unverified claims.`;
  }
  return `Candidate targeting entry-level ${label} opportunities. This version reorganizes only the facts present in the uploaded base resume and does not add unverified skills, tools, employers, dates or certifications.`;
}

function sectionOrder(role: ResumeRole) {
  if (role === "software-developer") {
    return ["SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES", "PERSONAL DETAILS", "ADDITIONAL"];
  }
  if (role === "technical-support") {
    return ["SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES", "PERSONAL DETAILS", "ADDITIONAL"];
  }
  return ["SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS", "ACHIEVEMENTS", "LANGUAGES", "PERSONAL DETAILS", "ADDITIONAL"];
}

function dedupe(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tailorResume(text: string, role: ResumeRole): TailoredResume {
  if (!roleLabels[role]) throw new Error("Unsupported resume role.");
  const parsed = parseSource(text);
  const summary = makeSummary(parsed.sourceText, role);
  const sections: ResumeSection[] = [];

  for (const heading of sectionOrder(role)) {
    const sourceLines = dedupe(parsed.sections.get(heading) || []);
    if (!sourceLines.length) continue;
    const lines = ["SKILLS", "PROJECTS", "EXPERIENCE", "ADDITIONAL"].includes(heading)
      ? stableRoleSort(sourceLines, role)
      : sourceLines;
    sections.push({ heading, lines });
  }

  if (!sections.length) {
    const fallback = cleanLines(text)
      .filter((line) => line !== parsed.candidateName && !looksLikeContact(line))
      .slice(0, 80);
    sections.push({ heading: "BASE RESUME CONTENT", lines: stableRoleSort(fallback, role) });
  }

  const warnings: string[] = [];
  if (!parsed.contactLine) warnings.push("Contact details were not confidently detected; review the generated resume before using it.");
  if (detectedEvidence(parsed.sourceText, role).length === 0) warnings.push(`No strong ${roleLabels[role]} keywords were found in the uploaded resume. The generator did not invent any.`);

  const plainText = [
    parsed.candidateName,
    roleLabels[role],
    parsed.contactLine,
    "",
    "SUMMARY",
    summary,
    "",
    ...sections.flatMap((section) => [section.heading, ...section.lines, ""]),
  ].filter((value) => value !== undefined).join("\n");

  return {
    role,
    roleLabel: roleLabels[role],
    candidateName: parsed.candidateName,
    contactLine: parsed.contactLine,
    summary,
    sections,
    plainText,
    warnings,
  };
}

function pdfSafe(value: string) {
  return value
    .replace(/₹/g, "INR ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function wrapText(text: string, maxChars: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderResumePdf(resume: TailoredResume) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 46;
  const bodySize = 9.5;
  const lineHeight = 13;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensure = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawWrapped = (text: string, options?: { size?: number; font?: typeof regular; indent?: number; gapAfter?: number }) => {
    const size = options?.size || bodySize;
    const font = options?.font || regular;
    const indent = options?.indent || 0;
    const maxChars = Math.max(45, Math.floor((pageWidth - margin * 2 - indent) / (size * 0.53)));
    const lines = wrapText(text, maxChars);
    ensure(lines.length * lineHeight + (options?.gapAfter || 0));
    for (const line of lines) {
      page.drawText(line, { x: margin + indent, y, size, font });
      y -= lineHeight;
    }
    y -= options?.gapAfter || 0;
  };

  drawWrapped(resume.candidateName, { size: 18, font: bold, gapAfter: 1 });
  drawWrapped(resume.roleLabel, { size: 10.5, font: bold, gapAfter: 2 });
  if (resume.contactLine) drawWrapped(resume.contactLine, { size: 8.5, gapAfter: 8 });

  const drawHeading = (heading: string) => {
    ensure(28);
    page.drawText(pdfSafe(heading), { x: margin, y, size: 10, font: bold });
    y -= 15;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.6 });
    y -= 4;
  };

  drawHeading("SUMMARY");
  drawWrapped(resume.summary, { gapAfter: 6 });

  for (const section of resume.sections) {
    drawHeading(section.heading);
    for (const line of section.lines) {
      const clean = line.replace(/^[-*]\s*/, "");
      drawWrapped(`- ${clean}`, { indent: 5, gapAfter: 1 });
    }
    y -= 4;
  }

  return pdf.save();
}

export function filenameForResume(resume: TailoredResume) {
  const name = resume.candidateName
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "Resume";
  const role = resume.roleLabel.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${name}_${role}.pdf`;
}
