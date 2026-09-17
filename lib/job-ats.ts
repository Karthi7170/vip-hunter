import { tailorResume, type ResumeRole, type TailoredResume } from "@/lib/resume-generator";
import { polishTailoredResume } from "@/lib/resume-professional";

export type AtsAnalysis = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  breakdown: {
    keywordCoverage: number;
    roleEvidence: number;
    structure: number;
    contact: number;
  };
  notes: string[];
};

const keywordCatalog: Array<[string, RegExp]> = [
  ["Manual Testing", /manual test|software testing/i],
  ["Test Cases", /test cases?/i],
  ["Functional Testing", /functional test/i],
  ["Regression Testing", /regression test|regression/i],
  ["Smoke Testing", /smoke test/i],
  ["Sanity Testing", /sanity test/i],
  ["Bug / Defect Tracking", /bug|defect|issue tracking/i],
  ["SDLC", /\bsdlc\b/i],
  ["STLC", /\bstlc\b/i],
  ["Selenium", /selenium|selinieum/i],
  ["Automation Testing", /automation testing|test automation|automated testing/i],
  ["API Testing", /api testing|rest assured|postman/i],
  ["Postman", /postman/i],
  ["Jira", /\bjira\b/i],
  ["Java", /\bjava\b|core java/i],
  ["SQL", /\bsql\b/i],
  ["HTML", /\bhtml5?\b/i],
  ["CSS", /\bcss3?\b/i],
  ["JavaScript", /javascript|\bjs\b/i],
  ["PHP", /\bphp\b/i],
  ["Python", /\bpython\b/i],
  ["React", /\breact\b/i],
  ["Next.js", /next\.?js/i],
  ["Node.js", /node\.?js/i],
  ["Git", /\bgit\b|github/i],
  ["Troubleshooting", /troubleshoot|diagnos|root cause/i],
  ["Technical Support", /technical support|system support|it support|service desk|help desk|helpdesk/i],
  ["Customer Support", /customer support|customer service|client support/i],
  ["Windows", /\bwindows\b/i],
  ["Linux", /\blinux\b/i],
  ["Networking", /networking|tcp\/ip|dns|dhcp/i],
  ["Active Directory", /active directory/i],
  ["Ticketing", /ticketing|service ticket|incident/i],
  ["Documentation", /documentation|documenting|records|tracking/i],
  ["MS Office", /microsoft office|ms office|\bexcel\b|\bword\b/i],
  ["Communication", /communication|verbal|written/i],
  ["Problem Solving", /problem[- ]solving|problem solving/i],
  ["Teamwork", /teamwork|collaboration|cross[- ]functional/i],
];

const rolePatterns: Record<ResumeRole, RegExp> = {
  "manual-testing": /manual test|software testing|test case|functional test|regression|smoke|sanity|bug|defect|sdlc|stlc|selenium|sql/i,
  "software-developer": /software developer|software engineer|html|css|javascript|php|sql|java|python|react|next\.?js|node\.?js|web app|website/i,
  "technical-support": /technical support|system support|it support|troubleshoot|windows|linux|networking|ticket|documentation|communication|ms office/i,
};

function keywordLabels(text: string) {
  return keywordCatalog
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label)
    .filter((label, index, all) => all.indexOf(label) === index);
}

function overlapScore(line: string, jd: string) {
  let score = 0;
  for (const [, pattern] of keywordCatalog) {
    if (pattern.test(jd) && pattern.test(line)) score += 3;
  }

  const jdTokens = new Set(
    jd
      .toLowerCase()
      .replace(/[^a-z0-9+#.\/-]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5),
  );

  for (const token of line.toLowerCase().split(/\s+/)) {
    if (jdTokens.has(token.replace(/[^a-z0-9+#.\/-]/g, ""))) score += 1;
  }
  return score;
}

function stableRank(lines: string[], jd: string) {
  return lines
    .map((line, index) => ({ line, index, score: overlapScore(line, jd) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.line);
}

function analyze(baseText: string, resume: TailoredResume, role: ResumeRole, jd: string): AtsAnalysis {
  const jdKeywords = keywordLabels(jd);
  const resumeText = resume.plainText;
  const matchedKeywords = jdKeywords.filter((label) => {
    const entry = keywordCatalog.find(([name]) => name === label);
    return entry ? entry[1].test(resumeText) : false;
  });
  const missingKeywords = jdKeywords.filter((label) => !matchedKeywords.includes(label));

  const keywordCoverage = jdKeywords.length
    ? Math.round((matchedKeywords.length / jdKeywords.length) * 65)
    : 0;
  const roleEvidence = rolePatterns[role].test(baseText) ? 15 : 5;
  const headings = new Set(resume.sections.map((section) => section.heading));
  const structure = Math.min(
    10,
    (headings.has("SKILLS") ? 3 : 0) +
      (headings.has("EXPERIENCE") || headings.has("PROJECTS") ? 3 : 0) +
      (headings.has("EDUCATION") ? 2 : 0) +
      (resume.summary.length >= 60 ? 2 : 0),
  );
  const contact = Math.min(
    10,
    (/@/.test(resume.contactLine) ? 4 : 0) +
      (/\b[6-9]\d{9}\b/.test(resume.contactLine) ? 3 : 0) +
      (/linkedin/i.test(resume.contactLine) ? 3 : 0),
  );

  const score = Math.max(0, Math.min(100, keywordCoverage + roleEvidence + structure + contact));
  const notes: string[] = [];
  if (missingKeywords.length) {
    notes.push(`JD keywords not verified in the generated resume: ${missingKeywords.slice(0, 8).join(", ")}. Only add them if they are genuinely true.`);
  }
  if (!jdKeywords.length) {
    notes.push("The job description did not contain enough recognized role keywords for a strong JD-specific score.");
  }
  if (contact < 10) notes.push("Complete contact details can improve ATS readability and recruiter follow-up.");

  return {
    score,
    matchedKeywords,
    missingKeywords,
    breakdown: { keywordCoverage, roleEvidence, structure, contact },
    notes,
  };
}

export function tailorResumeForJob(
  baseText: string,
  role: ResumeRole,
  jobDescription: string,
  jobTitle?: string,
  company?: string,
) {
  const base = tailorResume(baseText, role);
  const jd = jobDescription.trim();

  const sections = base.sections.map((section) => {
    if (["SKILLS", "EXPERIENCE", "PROJECTS", "CERTIFICATIONS"].includes(section.heading)) {
      return { ...section, lines: stableRank(section.lines, jd) };
    }
    return section;
  });

  const jdKeywords = keywordLabels(jd);
  const verified = keywordLabels(baseText);
  const matched = jdKeywords.filter((item) => verified.includes(item));
  const target = jobTitle?.trim() || base.roleLabel;
  const companyPhrase = company?.trim() ? ` at ${company.trim()}` : "";
  const qualification = /\bM\.?\s*C\.?\s*A\b/i.test(baseText) ? "MCA graduate" : "Candidate";
  const summary = matched.length
    ? `${qualification} targeting ${target}${companyPhrase}. Verified overlap with the job description includes ${matched.slice(0, 6).join(", ")}. The resume prioritizes only evidence already present in the base resume and does not add unverified skills or experience.`
    : `${qualification} targeting ${target}${companyPhrase}. This version is structured around the supplied job description while preserving only facts verified in the base resume.`;

  const tailored: TailoredResume = {
    ...base,
    roleLabel: target,
    summary,
    sections,
    plainText: [
      base.candidateName,
      target,
      base.contactLine,
      "",
      "SUMMARY",
      summary,
      "",
      ...sections.flatMap((section) => [section.heading, ...section.lines, ""]),
    ].join("\n"),
  };

  const polished = polishTailoredResume(baseText, tailored);

  return {
    resume: polished,
    ats: analyze(baseText, polished, role, jd),
  };
}
