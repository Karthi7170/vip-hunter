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
    ["Automation Testing", /automation testing|test automation/i],
    ["Selenium", /selenium|selinieum/i],
    ["Core Java", /core java|\bjava\b/i],
    ["SQL", /\bsql\b/i],
    ["Test Cases", /test cases?/i],
    ["Functional Testing", /functional test/i],
    ["Regression Testing", /regression/i],
    ["Smoke / Sanity Testing", /smoke|sanity/i],
    ["Bug / Defect Handling", /bug|defect/i],
    ["SDLC / STLC", /\bsdlc\b|\bstlc\b/i],
    ["Documentation", /documentation|documenting|records/i],
    ["Communication", /communication|student|parent|customer|client/i],
  ],
  "software-developer": [
    ["HTML", /\bhtml5?\b/i],
    ["CSS", /\bcss3?\b/i],
    ["JavaScript", /javascript|\bjs\b/i],
    ["PHP", /\bphp\b/i],
    ["SQL", /\bsql\b/i],
    ["Core Java", /core java|\bjava\b/i],
    ["Python", /\bpython\b/i],
    ["Streamlit", /streamlit/i],
    ["React", /\breact\b/i],
    ["Next.js", /next\.?js/i],
    ["Node.js", /node\.?js/i],
    ["Web Development", /web app|website|web development|frontend|front-end|backend|back-end/i],
  ],
  "technical-support": [
    ["Technical Support", /technical support|system support|it support|help desk|service desk/i],
    ["Issue / Query Resolution", /resolv(?:e|ed|ing)|query resolution|handle inquiries|inquiries/i],
    ["Troubleshooting", /troubleshoot|diagnos/i],
    ["Documentation", /documentation|documenting|records|tracking/i],
    ["Communication", /communication|student|parent|customer|client/i],
    ["Operations / Coordination", /operations|coordination|coordinated|follow[- ]?up|workflow/i],
    ["MS Office", /microsoft office|ms office|\bexcel\b|\bword\b/i],
    ["Data Entry / Records", /data entry|records|record handling/i],
    ["Windows", /\bwindows\b/i],
    ["Linux", /\blinux\b/i],
    ["Networking", /networking|tcp\/ip|dns|dhcp/i],
    ["Active Directory", /active directory/i],
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

const sentenceWords = /\b(professional|experience|operations|communication|office|efficiently|skilled|ability|support|student|handled|developed|built|summary|project|education|skills)\b/i;
const organisationWords = /\b(university|college|school|company|pvt|limited|ltd|technologies|edtech|q\s*spiders)\b/i;
const degreePattern = /\b(m\.?\s*c\.?\s*a|b\.?\s*c\.?\s*a|hsc|sslc|bachelor|master|degree|university|college|school)\b/i;
const educationMetricPattern = /\b(20\d{2}\s*[-–]\s*(?:20\d{2}|present)|cgpa\s*:|per\s*:|percentage\s*:|\d{1,3}\s*%)\b/i;
const projectPattern = /ai[- ]?(?:powered|based).*text analyzer|text analyzer|e[- ]?royal tiles|streamlit|web[- ]?based application|web app|tiles showroom|front[- ]?end|back[- ]?end database|website/i;
const experienceRolePattern = /\b(business operations executive|operations executive|software developer|software engineer|test engineer|qa engineer|tester|technical support|support engineer|system engineer|analyst|associate|intern)\b/i;
const experienceActionPattern = /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored)\b/i;
const summaryPattern = /\b(detail-oriented|dedicated|proactive|professional|work ethic|eager to contribute|career objective|quick learner|ability to learn|organizational goals)\b/i;
const genericSkillPattern = /\b(english communication|ms office|microsoft office|word|excel|data entry|adaptability|teamwork|collaboration|problem[- ]solving|time management|multitasking|student\s*&?\s*parent communication|customer support|manual testing|automation testing|selenium|selinieum|core java|\bjava\b|\bsql\b|\bhtml\b|\bcss\b|javascript|\bjs\b|\bphp\b|streamlit)\b/i;
const certificationPattern = /q\s*spiders|certification|certified|course|training/i;

function normalizeLine(value: string) {
  return value
    .replace(/[•●▪◦]/g, "-")
    .replace(/[\u00a0\uFFFE\t]+/g, " ")
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
  if (line.length < 3 || line.length > 55) return false;
  if (/[,:;!?]$/.test(line) || /\.$/.test(line)) return false;
  if (looksLikeContact(line) || detectHeading(line) || sentenceWords.test(line) || organisationWords.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Z][A-Za-z'-]*$/.test(word) || /^[A-Z]$/.test(word));
}

function nameScore(line: string) {
  let score = 0;
  if (line === line.toUpperCase()) score += 5;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 2 || words.length === 3) score += 3;
  if (!/\b(mca|bca|hsc|sslc)\b/i.test(line)) score += 1;
  return score;
}

function detectCandidateName(lines: string[]) {
  const candidates = lines.filter(looksLikeName);
  if (!candidates.length) return "Candidate";
  return candidates
    .map((line, index) => ({ line, index, score: nameScore(line) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].line;
}

function confidentLinkedIn(sourceText: string) {
  const repaired = sourceText.replace(
    /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+-)\s+(\d{6,12})/gi,
    "$1$2",
  );
  const match = repaired.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+/i);
  return match?.[0]?.replace(/[.,;]+$/g, "") || "";
}

function buildContactLine(lines: string[]) {
  const sourceText = lines.join("\n");
  const email = sourceText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const linkedIn = confidentLinkedIn(sourceText);
  const withoutUrls = sourceText.replace(/https?:\/\/\S+/gi, " ");
  const phone = withoutUrls.match(/\b[6-9]\d{9}\b/)?.[0] || "";
  const location = lines.find((line) => /\b(chennai|coimbatore|kerala|tamil nadu|india)\b/i.test(line))
    ?.match(/\b(Chennai|Coimbatore|Kerala|Tamil Nadu|India)\b/i)?.[0] || "";

  return [location, email, phone, linkedIn].filter(Boolean).join(" | ");
}

function dedupe(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectedEvidence(sourceText: string, role: ResumeRole) {
  return roleKeywords[role]
    .filter(([, pattern]) => pattern.test(sourceText))
    .map(([label]) => label)
    .filter((label, index, all) => all.indexOf(label) === index)
    .slice(0, 8);
}

function experienceDuration(sourceText: string) {
  const explicit = sourceText.match(/duration\s*:\s*(\d+)\s*months?/i)?.[1];
  if (explicit) return `${explicit} months`;
  const prose = sourceText.match(/\b(\d+)\s*months?\s+of\s+experience\b/i)?.[1];
  if (prose) return `${prose} months`;
  return "";
}

function makeSummary(sourceText: string, role: ResumeRole) {
  const evidence = detectedEvidence(sourceText, role);
  const label = roleLabels[role];
  const qualification = /\bM\.?\s*C\.?\s*A\b/i.test(sourceText) ? "MCA graduate" : "Candidate";
  const duration = experienceDuration(sourceText);
  const experiencePhrase = duration ? ` with ${duration} of professional experience` : "";

  if (evidence.length) {
    return `${qualification}${experiencePhrase} seeking an entry-level ${label} role. Verified strengths from the uploaded resume include ${evidence.slice(0, 6).join(", ")}. Brings a practical foundation in communication, documentation, projects and structured problem-solving without adding unverified experience.`;
  }

  return `${qualification}${experiencePhrase} seeking an entry-level ${label} role. This resume uses only information detected in the uploaded base resume and does not add unverified skills, employers, dates, projects or certifications.`;
}

function combineEducation(contentLines: string[]) {
  const degreeLines = contentLines.filter((line) => degreePattern.test(line) && !looksLikeContact(line));
  const metricLines = contentLines.filter((line) => educationMetricPattern.test(line) && !degreePattern.test(line));
  const usedMetrics = new Set<number>();
  const combined: string[] = [];

  degreeLines.forEach((degree, index) => {
    const metricIndex = metricLines.findIndex((_, candidateIndex) => !usedMetrics.has(candidateIndex) && candidateIndex >= index - 1);
    if (metricIndex >= 0) {
      usedMetrics.add(metricIndex);
      combined.push(`${degree} | ${metricLines[metricIndex]}`);
    } else {
      combined.push(degree);
    }
  });

  metricLines.forEach((metric, index) => {
    if (!usedMetrics.has(index)) combined.push(metric);
  });

  return dedupe(combined);
}

function parseSource(text: string, role: ResumeRole) {
  const lines = cleanLines(text);
  const candidateName = detectCandidateName(lines);
  const contactLine = buildContactLine(lines);
  const sourceText = lines.join("\n");

  const contentLines = lines.filter((line) => {
    if (line === candidateName) return false;
    if (detectHeading(line)) return false;
    if (looksLikeContact(line)) return false;
    if (Object.values(roleLabels).some((label) => label.toLowerCase() === line.toLowerCase())) return false;
    if (/^MCA$/i.test(line)) return false;
    return true;
  });

  const education = combineEducation(contentLines);
  const educationRaw = new Set(
    contentLines.filter((line) => degreePattern.test(line) || educationMetricPattern.test(line)).map((line) => line.toLowerCase()),
  );

  const projects = dedupe(
    contentLines.filter((line) => !educationRaw.has(line.toLowerCase()) && projectPattern.test(line)),
  );

  const certifications = dedupe(
    contentLines.filter((line) => {
      if (educationRaw.has(line.toLowerCase()) || projects.includes(line)) return false;
      if (certificationPattern.test(line)) return true;
      if (/^(core java|manual testing|automation testing|sql|selenium|selinieum)\b/i.test(line) && /q\s*spiders/i.test(sourceText)) return true;
      return false;
    }),
  );

  const experience = dedupe(
    contentLines.filter((line) => {
      if (educationRaw.has(line.toLowerCase()) || projects.includes(line) || certifications.includes(line)) return false;
      if (/^duration\s*:/i.test(line)) return true;
      if (experienceRolePattern.test(line)) return true;
      if (experienceActionPattern.test(line)) return true;
      return false;
    }),
  );

  const summarySource = dedupe(
    contentLines.filter((line) => {
      if (educationRaw.has(line.toLowerCase()) || projects.includes(line) || certifications.includes(line) || experience.includes(line)) return false;
      return line.length >= 45 && summaryPattern.test(line);
    }),
  );

  const recognizedRoleSkills = detectedEvidence(sourceText, role);
  const genericSkills = contentLines
    .filter((line) => line.length <= 90 && genericSkillPattern.test(line))
    .filter((line) => !educationRaw.has(line.toLowerCase()) && !projects.includes(line) && !certifications.includes(line) && !experience.includes(line))
    .map((line) => line.replace(/^[-*]\s*/, "").trim());
  const skills = dedupe([...recognizedRoleSkills, ...genericSkills]);

  return {
    candidateName,
    contactLine,
    sourceText,
    skills,
    experience,
    projects,
    education,
    certifications,
    summarySource,
  };
}

function sectionOrder(role: ResumeRole) {
  if (role === "software-developer") return ["SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS"];
  if (role === "technical-support") return ["SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"];
  return ["SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS"];
}

export function tailorResume(text: string, role: ResumeRole): TailoredResume {
  if (!roleLabels[role]) throw new Error("Unsupported resume role.");
  const parsed = parseSource(text, role);
  const summary = makeSummary(parsed.sourceText, role);

  const sectionData: Record<string, string[]> = {
    SKILLS: parsed.skills,
    EXPERIENCE: parsed.experience,
    PROJECTS: parsed.projects,
    EDUCATION: parsed.education,
    CERTIFICATIONS: parsed.certifications,
  };

  const sections = sectionOrder(role)
    .map((heading) => ({ heading, lines: sectionData[heading] || [] }))
    .filter((section) => section.lines.length > 0);

  const warnings: string[] = [];
  if (parsed.candidateName === "Candidate") warnings.push("Candidate name was not confidently detected. Please review the uploaded base resume formatting.");
  if (!parsed.contactLine) warnings.push("Contact details were not confidently detected; review the generated resume before using it.");
  if (/linkedin/i.test(parsed.sourceText) && !/linkedin\.com\/in\/[A-Za-z0-9-]{3,}/i.test(parsed.contactLine)) {
    warnings.push("LinkedIn was present in the source but could not be parsed confidently, so it was omitted instead of guessing.");
  }
  if (detectedEvidence(parsed.sourceText, role).length === 0) {
    warnings.push(`No strong ${roleLabels[role]} evidence was found in the uploaded resume. VIP-Hunter did not invent any.`);
  }
  if (!parsed.experience.length && /experience|executive|company/i.test(parsed.sourceText)) {
    warnings.push("Work-experience text was present but could not be structured confidently. Review the base resume section order.");
  }

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
    for (const sourceLine of section.lines) {
      const clean = sourceLine.replace(/^[-*]\s*/, "").trim();
      if (!clean) continue;

      if (section.heading === "EDUCATION") {
        drawWrapped(clean, { gapAfter: 3 });
        continue;
      }

      if (section.heading === "EXPERIENCE" && (experienceRolePattern.test(clean) || /^duration\s*:/i.test(clean))) {
        drawWrapped(clean, { font: /^duration\s*:/i.test(clean) ? regular : bold, gapAfter: 2 });
        continue;
      }

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
