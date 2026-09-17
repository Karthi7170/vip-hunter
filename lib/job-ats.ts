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

const summaryPriority: Record<ResumeRole, string[]> = {
  "manual-testing": [
    "Manual Testing", "Test Cases", "Functional Testing", "Regression Testing", "Smoke Testing",
    "Sanity Testing", "Bug / Defect Tracking", "STLC", "SDLC", "SQL", "Selenium",
    "Automation Testing", "API Testing", "Postman", "Jira", "Java", "Documentation", "Communication",
  ],
  "software-developer": [
    "Python", "Java", "JavaScript", "SQL", "HTML", "CSS", "React", "Next.js", "Node.js",
    "PHP", "Git", "Problem Solving", "Teamwork", "Communication", "Documentation",
  ],
  "technical-support": [
    "Technical Support", "Troubleshooting", "Windows", "Linux", "Networking", "Active Directory",
    "Ticketing", "Customer Support", "Documentation", "Communication", "MS Office", "Problem Solving", "Teamwork",
  ],
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

function listPhrase(items: string[]) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function summarySkills(role: ResumeRole, matched: string[]) {
  const rank = new Map(summaryPriority[role].map((item, index) => [item, index]));
  return [...matched]
    .sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999))
    .slice(0, 5);
}

function transferableStrengths(baseText: string) {
  const strengths: string[] = [];
  if (/documentation|records|tracking/i.test(baseText)) strengths.push("documentation and record tracking");
  if (/coordinated|internal teams|team onboarding|process management/i.test(baseText)) strengths.push("cross-team coordination");
  if (/communication|interacting|calls|follow-ups|guidance|queries/i.test(baseText)) strengths.push("professional communication");
  if (/administrative|operational activities|workflow|operations/i.test(baseText)) strengths.push("structured operational support");
  return strengths.slice(0, 3);
}

function buildJdSummary(baseText: string, role: ResumeRole, target: string, matched: string[]) {
  const qualification = /\bM\.?\s*C\.?\s*A\b/i.test(baseText) ? "MCA graduate" : "Candidate";
  const skills = summarySkills(role, matched);
  const skillsText = listPhrase(skills);
  const strengths = transferableStrengths(baseText);
  const strengthsText = listPhrase(strengths);
  const hasProjectEvidence = /\b(projects?|web app|website|developed|built|text analyzer|tiles)\b/i.test(baseText);

  if (role === "software-developer") {
    const opening = hasProjectEvidence
      ? `${qualification} with hands-on academic project experience in web application development`
      : `${qualification} with a foundation in software development`;
    const skillSentence = skillsText ? ` and relevant technical skills in ${skillsText}.` : ".";
    const transferSentence = strengthsText
      ? ` Professional experience has strengthened ${strengthsText}, supporting a disciplined and collaborative approach to software delivery.`
      : " Brings a structured, learning-focused approach to software development and problem-solving.";
    return `${opening}${skillSentence}${transferSentence} Seeking the ${target} opportunity to apply these strengths while continuing to grow in the technologies required by the role.`;
  }

  if (role === "manual-testing") {
    const opening = skillsText
      ? `${qualification} pursuing the ${target} opportunity with verified knowledge in ${skillsText}.`
      : `${qualification} pursuing the ${target} opportunity with a foundation in software quality and structured problem-solving.`;
    const transferSentence = strengthsText
      ? ` Brings professional strengths in ${strengthsText}, supporting a detail-oriented and process-focused approach to quality assurance.`
      : " Brings a detail-oriented and process-focused approach to software quality.";
    return `${opening}${transferSentence}`;
  }

  const opening = skillsText
    ? `${qualification} pursuing the ${target} opportunity with relevant strengths in ${skillsText}.`
    : `${qualification} pursuing the ${target} opportunity with a foundation in user support and structured problem-solving.`;
  const transferSentence = strengthsText
    ? ` Professional experience in ${strengthsText} provides a strong foundation for responsive, well-documented technical support.`
    : " Brings a service-oriented, organized approach to technical support and issue resolution.";
  return `${opening}${transferSentence}`;
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
  const summary = buildJdSummary(baseText, role, target, matched);

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
