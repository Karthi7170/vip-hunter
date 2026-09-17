import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TailoredResume } from "@/lib/resume-generator";

const ROLE_LINE = /\b(business operations executive|operations executive|software developer|software engineer|associate software engineer|test engineer|qa engineer|tester|technical support|support engineer|system engineer|analyst|associate|intern)\b/i;
const ACTION_LINE = /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored|developed|built|implemented|tested|designed|documented|collaborated)\b/i;
const EDUCATION_TOKEN = /\b(M\.?\s*C\.?\s*A|B\.?\s*C\.?\s*A|HSC|SSLC|bachelor(?:'s)?|master(?:'s)?)\b/i;
const INSTITUTION_TOKEN = /\b(university|college|school|institute|academy|matric|higher secondary|hr\.?\s*sec)\b/i;
const EDUCATION_METRIC = /\b(20\d{2}\s*[-–]\s*(?:20\d{2}|present)|cgpa\s*:?\s*\d|percentage\s*:?|\d{1,3}\s*%)\b/i;
const KNOWN_HEADING = /^(summary|professional summary|profile|objective|career objective|skills|technical skills|key skills|core skills|experience|work experience|professional experience|employment|projects?|education|academic qualifications?|certifications?|courses?|training|achievements?|awards?|languages?|personal details?)\s*:?[\s]*$/i;
const INCOMPLETE_END = /\b(with|and|or|to|for|through|providing|including|while|of|in|on|at|by|from)$/i;

function clean(value: string) {
  return value
    .replace(/[•●▪◦]/g, "-")
    .replace(/[\u00a0\uFFFE\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-*]\s*/, "")
    .trim();
}

function sourceLines(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
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

function looksComplete(line: string) {
  if (!line || line.length < 3) return false;
  if (INCOMPLETE_END.test(line)) return false;
  return true;
}

function cleanSkills(lines: string[]) {
  return dedupe(
    lines
      .map(clean)
      .filter((line) => line.length >= 2 && line.length <= 64)
      .filter((line) => !/[.!?]\s/.test(line))
      .filter((line) => line.split(/\s+/).length <= 9)
      .filter((line) => !/^(skills?|communication,)\b/i.test(line)),
  );
}

function cleanProjects(lines: string[]) {
  return dedupe(lines.map(clean).filter(looksComplete).filter((line) => line.length >= 12));
}

function cleanExperience(lines: string[]) {
  const cleaned = dedupe(lines.map(clean).filter(Boolean));
  const headers = cleaned.filter((line) => ROLE_LINE.test(line) && !ACTION_LINE.test(line));
  const bullets = cleaned
    .filter((line) => !headers.includes(line))
    .filter(looksComplete)
    .filter((line) => ACTION_LINE.test(line) || line.length >= 28);
  return dedupe([...headers, ...bullets]);
}

function educationSectionFromSource(baseText: string) {
  const lines = sourceLines(baseText);
  const headingIndex = lines.findIndex((line) => /^education\s*:?$/i.test(line));
  let pool = lines;

  if (headingIndex >= 0) {
    const collected: string[] = [];
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (KNOWN_HEADING.test(line)) break;
      collected.push(line);
    }
    if (collected.length) pool = collected;
  }

  const entries: string[] = [];
  for (let index = 0; index < pool.length; index += 1) {
    const line = pool[index];
    if (!EDUCATION_TOKEN.test(line)) continue;

    const parts = [line];
    let lookAhead = index + 1;

    if (/^(M\.?\s*C\.?\s*A|B\.?\s*C\.?\s*A|HSC|SSLC)$/i.test(line) && pool[lookAhead] && INSTITUTION_TOKEN.test(pool[lookAhead])) {
      parts.push(pool[lookAhead]);
      lookAhead += 1;
    }

    if (pool[lookAhead] && EDUCATION_METRIC.test(pool[lookAhead]) && !KNOWN_HEADING.test(pool[lookAhead])) {
      parts.push(pool[lookAhead]);
      lookAhead += 1;
    }

    const joined = parts.join(" | ");
    if (looksComplete(joined)) entries.push(joined);
    index = Math.max(index, lookAhead - 1);
  }

  if (!entries.length) {
    return dedupe(
      pool
        .filter((line) => (EDUCATION_TOKEN.test(line) || INSTITUTION_TOKEN.test(line)) && looksComplete(line))
        .filter((line) => !/skills?|support day-to-day|records, handle inquiries/i.test(line)),
    );
  }

  return dedupe(entries);
}

export function polishTailoredResume(baseText: string, resume: TailoredResume): TailoredResume {
  const existing = new Map(resume.sections.map((section) => [section.heading, section.lines]));
  const recoveredEducation = educationSectionFromSource(baseText);

  const sections = resume.sections
    .map((section) => {
      if (section.heading === "SKILLS") return { ...section, lines: cleanSkills(section.lines) };
      if (section.heading === "EXPERIENCE") return { ...section, lines: cleanExperience(section.lines) };
      if (section.heading === "PROJECTS") return { ...section, lines: cleanProjects(section.lines) };
      if (section.heading === "EDUCATION") {
        const preferred = recoveredEducation.length ? recoveredEducation : section.lines.map(clean).filter(looksComplete);
        return { ...section, lines: dedupe(preferred).filter((line) => !/support day-to-day|records, handle inquiries/i.test(line)) };
      }
      return { ...section, lines: dedupe(section.lines.map(clean).filter(looksComplete)) };
    })
    .filter((section) => section.lines.length > 0);

  if (!sections.some((section) => section.heading === "EDUCATION") && recoveredEducation.length) {
    sections.push({ heading: "EDUCATION", lines: recoveredEducation });
  }

  // Preserve any section that may have been omitted by an upstream transformation.
  for (const heading of ["SKILLS", "PROJECTS", "EXPERIENCE", "EDUCATION", "CERTIFICATIONS"]) {
    if (sections.some((section) => section.heading === heading)) continue;
    const lines = existing.get(heading) || [];
    if (lines.length) sections.push({ heading, lines: dedupe(lines.map(clean).filter(looksComplete)) });
  }

  const plainText = [
    resume.candidateName,
    resume.roleLabel,
    resume.contactLine,
    "",
    "SUMMARY",
    resume.summary,
    "",
    ...sections.flatMap((section) => [section.heading, ...section.lines, ""]),
  ].join("\n");

  return { ...resume, sections, plainText };
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

function wrapByWidth(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderProfessionalResumePdf(resume: TailoredResume) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 48;
  const marginTop = 46;
  const marginBottom = 46;
  const contentWidth = pageWidth - marginX * 2;
  const bodySize = 9.4;
  const bodyLine = 12.8;
  const dark = rgb(0.08, 0.12, 0.1);
  const muted = rgb(0.34, 0.4, 0.37);
  const accent = rgb(0.08, 0.34, 0.21);
  const rule = rgb(0.78, 0.84, 0.8);

  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
  };

  const ensure = (height: number) => {
    if (y - height < marginBottom) newPage();
  };

  const drawWrapped = (
    text: string,
    options?: {
      font?: PDFFont;
      size?: number;
      x?: number;
      width?: number;
      lineHeight?: number;
      color?: ReturnType<typeof rgb>;
      gapAfter?: number;
    },
  ) => {
    const font = options?.font || regular;
    const size = options?.size || bodySize;
    const x = options?.x ?? marginX;
    const width = options?.width ?? contentWidth;
    const lineHeight = options?.lineHeight || bodyLine;
    const color = options?.color || dark;
    const lines = wrapByWidth(text, font, size, width);
    ensure(lines.length * lineHeight + (options?.gapAfter || 0));
    for (const line of lines) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
    }
    y -= options?.gapAfter || 0;
    return lines.length;
  };

  const drawCenteredWrapped = (text: string, font: PDFFont, size: number, maxWidth: number, color = dark, gapAfter = 0) => {
    const lines = wrapByWidth(text, font, size, maxWidth);
    const lineHeight = size + 3.3;
    ensure(lines.length * lineHeight + gapAfter);
    for (const line of lines) {
      const width = font.widthOfTextAtSize(line, size);
      page.drawText(line, { x: (pageWidth - width) / 2, y, size, font, color });
      y -= lineHeight;
    }
    y -= gapAfter;
  };

  const drawHeading = (heading: string) => {
    ensure(32);
    y -= 5;
    page.drawText(pdfSafe(heading), { x: marginX, y, size: 10.2, font: bold, color: accent });
    y -= 8;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageWidth - marginX, y },
      thickness: 0.7,
      color: rule,
    });
    y -= 10;
  };

  const drawBullet = (text: string) => {
    const bulletX = marginX + 2;
    const textX = marginX + 14;
    const width = contentWidth - 14;
    const lines = wrapByWidth(text, regular, bodySize, width);
    ensure(lines.length * bodyLine + 2);
    page.drawText("-", { x: bulletX, y, size: bodySize, font: regular, color: dark });
    for (const line of lines) {
      page.drawText(line, { x: textX, y, size: bodySize, font: regular, color: dark });
      y -= bodyLine;
    }
    y -= 1.5;
  };

  // Header: centered, compact, ATS-safe, and visually balanced.
  drawCenteredWrapped(resume.candidateName.toUpperCase(), bold, 20.5, contentWidth, dark, 1);
  drawCenteredWrapped(resume.roleLabel, bold, 10.8, contentWidth, accent, 2);
  if (resume.contactLine) drawCenteredWrapped(resume.contactLine, regular, 8.3, contentWidth, muted, 8);
  page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.85, color: rule });
  y -= 8;

  drawHeading("SUMMARY");
  drawWrapped(resume.summary, { gapAfter: 5, lineHeight: 13.2 });

  for (const section of resume.sections) {
    if (!section.lines.length) continue;
    drawHeading(section.heading);

    if (section.heading === "SKILLS") {
      const skillText = section.lines.map((line) => clean(line)).filter(Boolean).join(" | ");
      drawWrapped(skillText, { gapAfter: 4, lineHeight: 13.2 });
      continue;
    }

    if (section.heading === "EXPERIENCE") {
      for (const rawLine of section.lines) {
        const line = clean(rawLine);
        if (!line) continue;
        if (ROLE_LINE.test(line) && !ACTION_LINE.test(line)) {
          ensure(18);
          drawWrapped(line, { font: bold, size: 10, gapAfter: 2, lineHeight: 13 });
        } else {
          drawBullet(line);
        }
      }
      y -= 2;
      continue;
    }

    if (section.heading === "PROJECTS") {
      for (const rawLine of section.lines) {
        const line = clean(rawLine);
        if (!line) continue;
        drawBullet(line);
      }
      y -= 2;
      continue;
    }

    if (section.heading === "EDUCATION") {
      for (const rawLine of section.lines) {
        const line = clean(rawLine);
        if (!line) continue;
        const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          ensure(18);
          const first = pdfSafe(parts[0]);
          const rest = pdfSafe(parts.slice(1).join(" | "));
          const firstWidth = bold.widthOfTextAtSize(first, bodySize);
          const restWidth = regular.widthOfTextAtSize(` | ${rest}`, bodySize);
          if (firstWidth + restWidth <= contentWidth) {
            page.drawText(first, { x: marginX, y, size: bodySize, font: bold, color: dark });
            page.drawText(` | ${rest}`, { x: marginX + firstWidth, y, size: bodySize, font: regular, color: dark });
            y -= bodyLine + 2;
          } else {
            drawWrapped(first, { font: bold, gapAfter: 0 });
            drawWrapped(rest, { x: marginX + 12, width: contentWidth - 12, color: muted, gapAfter: 2 });
          }
        } else {
          drawWrapped(line, { gapAfter: 2 });
        }
      }
      continue;
    }

    for (const rawLine of section.lines) {
      const line = clean(rawLine);
      if (line) drawBullet(line);
    }
  }

  return pdf.save();
}
