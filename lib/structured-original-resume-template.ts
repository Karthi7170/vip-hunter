import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { TailoredResume } from "@/lib/resume-generator";

const PAGE_W = 595.5;
const PAGE_H = 842.25;
const LEFT = 29.2;
const RIGHT = 556.0;
const strictRolePattern = /\b(business operations executive|operations executive|software developer|software engineer|associate software engineer|test engineer|qa engineer|qa tester|software tester|manual tester|technical support(?: engineer)?|support engineer|system engineer|business analyst|data analyst|analyst|intern)\b/i;
const actionPattern = /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored|developed|built|tested|implemented|designed|documented|collaborated)\b/i;

function safe(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/₹/g, "INR ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function section(resume: TailoredResume, heading: string) {
  return resume.sections.find((item) => item.heading === heading)?.lines || [];
}

function qualification(sourceText: string) {
  return /\bM\.?\s*C\.?\s*A\b/i.test(sourceText) ? "MCA" : "";
}

function contactParts(contactLine: string) {
  const parts = contactLine.split("|").map((part) => part.trim()).filter(Boolean);
  const linkedIn = parts.find((part) => /linkedin\.com/i.test(part)) || "";
  const first = parts.filter((part) => part !== linkedIn).join(" | ");
  return { first, linkedIn };
}

function experienceParts(resume: TailoredResume) {
  const rows = section(resume, "EXPERIENCE").map((line) => safe(line)).filter(Boolean);
  const title = rows.find((line) => strictRolePattern.test(line) && !actionPattern.test(line)) || "";
  const bullets = rows.filter((line) => line !== title && actionPattern.test(line)).slice(0, 5);
  return { title, bullets };
}

function skillsForTemplate(resume: TailoredResume) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of section(resume, "SKILLS")) {
    const item = safe(raw.replace(/^[-*]\s*/, ""));
    const key = item.toLowerCase();
    if (!item || seen.has(key) || item.length > 62 || /[.!?]$/.test(item)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === 6) break;
  }
  return out;
}

function educationRows(resume: TailoredResume) {
  return section(resume, "EDUCATION").slice(0, 4).map((raw) => {
    const line = safe(raw);
    const match = line.match(/\b20\d{2}\s*-\s*(?:20\d{2}|present)\b/i);
    if (!match || match.index == null) return { degree: line.replace(/\s*\|\s*$/, ""), metric: "" };
    const degree = line.slice(0, match.index).replace(/\s*\|\s*$/, "").trim();
    const metric = line.slice(match.index).trim();
    return { degree, metric };
  });
}

function projectLines(resume: TailoredResume) {
  return section(resume, "PROJECTS").map((line) => safe(line)).filter(Boolean).slice(0, 2);
}

export async function renderStructuredOriginalResumeTemplate(resume: TailoredResume, sourceText: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.08, 0.08, 0.08);
  const gray = rgb(0.28, 0.28, 0.28);

  const yTop = (top: number, size: number) => PAGE_H - top - size;
  const textTop = (text: string, x: number, top: number, size: number, font = regular) => {
    page.drawText(safe(text), { x, y: yTop(top, size), size, font, color: black });
  };
  const rule = (top: number, x1 = LEFT, x2 = RIGHT, thickness = 1.25) => {
    const y = PAGE_H - top;
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: gray });
  };

  const wrap = (text: string, font: typeof regular, size: number, maxWidth: number) => {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) out.push(current);
    return out;
  };

  const fitSummary = (text: string) => {
    if (wrap(text, regular, 12.9, 524).length <= 5) return text;
    const sentences = safe(text).match(/[^.!?]+[.!?]/g)?.map((value) => value.trim()) || [];
    let fitted = "";
    for (const sentence of sentences) {
      const next = fitted ? `${fitted} ${sentence}` : sentence;
      if (wrap(next, regular, 12.9, 524).length > 5) break;
      fitted = next;
    }
    if (fitted) return fitted;

    const words = safe(text).split(/\s+/);
    let candidate = "";
    for (const word of words) {
      const next = candidate ? `${candidate} ${word}` : word;
      if (wrap(`${next}.`, regular, 12.9, 524).length > 5) break;
      candidate = next;
    }
    return `${candidate.replace(/[,:;\-]+$/, "")}.`;
  };

  const wrappedTop = (
    text: string,
    x: number,
    top: number,
    size: number,
    maxWidth: number,
    lineHeight: number,
    font = regular,
    maxLines = 99,
  ) => {
    const wrapped = wrap(text, font, size, maxWidth).slice(0, maxLines);
    wrapped.forEach((line, index) => textTop(line, x, top + index * lineHeight, size, font));
    return wrapped.length;
  };

  const bulletBlock = (items: string[], top: number, maxBottom: number) => {
    let cursor = top;
    for (const item of items) {
      const bodyLines = wrap(item, regular, 12.7, RIGHT - 55);
      const needed = bodyLines.length * 17.2;
      if (cursor + needed > maxBottom) break;
      page.drawCircle({ x: 42.1, y: PAGE_H - cursor - 7.2, size: 1.8, color: black });
      bodyLines.forEach((line, index) => textTop(line, 51.5, cursor + index * 17.2, 12.7));
      cursor += needed + 1.2;
    }
  };

  const { first: contactFirst, linkedIn } = contactParts(resume.contactLine);
  textTop(resume.candidateName.toUpperCase(), 37.5, 8, 21.5, bold);
  const qual = qualification(sourceText);
  if (qual) textTop(qual, 37.5, 35, 21.5, bold);
  if (contactFirst) textTop(contactFirst, 37.5, 67, 13.1);
  if (linkedIn) textTop(linkedIn, 37.5, 87, 13.1);
  rule(108, 37, 557, 1.5);

  textTop("SUMMARY", 29.2, 121, 14.5, bold);
  wrappedTop(fitSummary(resume.summary), 29.2, 145, 12.9, 524, 18.2, regular, 5);
  rule(239, 39, 548, 1.1);

  textTop("WORK EXPERIENCE", 29.2, 251, 14.5, bold);
  const experience = experienceParts(resume);
  if (experience.title) textTop(experience.title, 29.2, 273, 12.5, bold);
  bulletBlock(experience.bullets, 314, 456);

  textTop("SKILLS", 29.2, 463, 14.5, bold);
  rule(489, 107, 520, 1.2);
  const skills = skillsForTemplate(resume);
  const leftSkills = skills.slice(0, 3);
  const rightSkills = skills.slice(3, 6);
  leftSkills.forEach((skill, index) => {
    const top = 505 + index * 19;
    page.drawCircle({ x: 43.1, y: PAGE_H - top - 7.2, size: 1.7, color: black });
    textTop(skill, 52.5, top, 12.8);
  });
  rightSkills.forEach((skill, index) => {
    const top = 505 + index * 19;
    page.drawCircle({ x: 277.0, y: PAGE_H - top - 7.2, size: 1.7, color: black });
    textTop(skill, 286.5, top, 12.8);
  });

  textTop("EDUCATION", 29.2, 560, 14.5, bold);
  rule(584, 28, 557, 0.8);
  educationRows(resume).forEach((row, index) => {
    const top = 600 + index * 22;
    textTop(row.degree, 38.5, top, 12.8);
    if (row.metric) {
      const metric = safe(row.metric);
      const width = regular.widthOfTextAtSize(metric, 12.8);
      textTop(metric, Math.max(360, RIGHT - width), top, 12.8);
    }
  });

  textTop("PROJECTS", 22.6, 692, 14.5, bold);
  rule(715, 28, 557, 0.8);
  projectLines(resume).forEach((project, index) => {
    wrappedTop(project, 31.5, 737 + index * 24, 12.8, 524, 17.5, regular, 2);
  });

  return pdf.save();
}
