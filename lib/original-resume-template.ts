import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { TailoredResume } from "@/lib/resume-generator";

const PAGE_W = 595.5;
const PAGE_H = 842.25;
const LEFT = 29.2;
const RIGHT = 556.0;

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

function lines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/[•●▪◦]/g, "-").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function section(resume: TailoredResume, heading: string) {
  return resume.sections.find((item) => item.heading === heading)?.lines || [];
}

function isSentence(value: string) {
  return value.length > 72 || /\b(possess|professional experience|administrative support|ability to|day-to-day|efficiently)\b/i.test(value);
}

function originalQualification(sourceText: string) {
  const found = lines(sourceText).find((line) => /^(m\.?\s*c\.?\s*a|mca)$/i.test(line));
  return found ? found.replace(/\s+/g, "").replace(/\./g, "").toUpperCase() : "MCA";
}

function originalExperienceTitle(sourceText: string, resume: TailoredResume) {
  const fromResume = section(resume, "EXPERIENCE").find((line) =>
    /\b(executive|engineer|developer|tester|analyst|associate|intern|support)\b/i.test(line),
  );
  if (fromResume) return fromResume.replace(/^[-*]\s*/, "").trim();
  return lines(sourceText).find((line) => /\b(executive|engineer|developer|tester|analyst|associate|intern|support)\b/i.test(line)) || "";
}

function experienceBullets(sourceText: string, resume: TailoredResume) {
  const title = originalExperienceTitle(sourceText, resume).toLowerCase();
  const ordered = section(resume, "EXPERIENCE")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line && line.toLowerCase() !== title)
    .filter((line) => !/^duration\s*:/i.test(line))
    .filter((line) => /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored|developed|built|tested|implemented)\b/i.test(line));

  if (ordered.length) return ordered.slice(0, 6);

  return lines(sourceText)
    .filter((line) => /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored)\b/i.test(line))
    .slice(0, 6);
}

function skillsForTemplate(resume: TailoredResume) {
  const raw = section(resume, "SKILLS")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line && !isSentence(line))
    .filter((line) => !/[.!?]$/.test(line));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === 6) break;
  }
  return out;
}

function projectLines(resume: TailoredResume, sourceText: string) {
  const fromResume = section(resume, "PROJECTS")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  if (fromResume.length) return fromResume.slice(0, 2);

  return lines(sourceText)
    .filter((line) => /text analyzer|e[- ]?royal tiles|website|web app|project/i.test(line))
    .slice(0, 2);
}

function educationRows(sourceText: string) {
  const sourceLines = lines(sourceText);
  const degrees = [
    sourceLines.find((line) => /\bM\.?\s*C\.?\s*A\b/i.test(line) && /university|college/i.test(line)),
    sourceLines.find((line) => /\bB\.?\s*C\.?\s*A\b/i.test(line) && /university|college/i.test(line)),
    sourceLines.find((line) => /^HSC\b/i.test(line)),
    sourceLines.find((line) => /^SSLC\b/i.test(line)),
  ].filter((value): value is string => Boolean(value));

  const metrics = sourceLines.filter((line) =>
    /\b20\d{2}\s*[-–]\s*20\d{2}\b/i.test(line) && /cgpa|per\s*:|percentage/i.test(line),
  );

  return degrees.slice(0, 4).map((degree, index) => ({
    degree: degree.replace(/\s+\./g, ".").trim(),
    metric: metrics[index] || "",
  }));
}

function contactParts(contactLine: string) {
  const parts = contactLine.split("|").map((part) => part.trim()).filter(Boolean);
  const linkedIn = parts.find((part) => /linkedin\.com/i.test(part)) || "";
  const first = parts.filter((part) => part !== linkedIn).join(" | ");
  return { first, linkedIn };
}

export async function renderOriginalResumeTemplate(resume: TailoredResume, sourceText: string) {
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
  textTop(originalQualification(sourceText), 37.5, 35, 21.5, bold);
  if (contactFirst) textTop(contactFirst, 37.5, 67, 13.1);
  if (linkedIn) textTop(linkedIn, 37.5, 87, 13.1);
  rule(108, 37, 557, 1.5);

  textTop("SUMMARY", 29.2, 121, 14.5, bold);
  wrappedTop(resume.summary, 29.2, 145, 12.9, 524, 18.2, regular, 5);
  rule(239, 39, 548, 1.1);

  textTop("WORK EXPERIENCE", 29.2, 251, 14.5, bold);
  const expTitle = originalExperienceTitle(sourceText, resume);
  if (expTitle) textTop(expTitle, 29.2, 273, 12.5, bold);
  bulletBlock(experienceBullets(sourceText, resume), 314, 456);

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
  const edu = educationRows(sourceText);
  edu.forEach((row, index) => {
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
  projectLines(resume, sourceText).forEach((project, index) => {
    wrappedTop(project, 31.5, 737 + index * 24, 12.8, 524, 17.5, regular, 2);
  });

  return pdf.save();
}
