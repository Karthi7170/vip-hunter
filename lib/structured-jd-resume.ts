import type { ResumeRole, ResumeSection, TailoredResume } from "@/lib/resume-generator";

const headingPattern = /^(summary|professional summary|profile|objective|career objective|skills|technical skills|key skills|core skills|experience|work experience|professional experience|employment|projects?|education|academic qualifications?|certifications?|courses?|training|achievements?|awards?|languages?|personal details?)\s*:?[\s]*$/i;
const strictRolePattern = /\b(business operations executive|operations executive|software developer|software engineer|associate software engineer|test engineer|qa engineer|qa tester|software tester|manual tester|technical support(?: engineer)?|support engineer|system engineer|business analyst|data analyst|analyst|intern)\b/i;
const actionPattern = /^(handled|maintained|supported|coordinated|executed|demonstrated|managed|assisted|resolved|provided|worked|performed|created|prepared|tracked|communicated|guided|ensured|organized|monitored|developed|built|tested|implemented|designed|documented|collaborated)\b/i;
const degreePattern = /\b(m\.?\s*c\.?\s*a|b\.?\s*c\.?\s*a|hsc|sslc)\b/i;
const institutionPattern = /\b(university|college|school|institute|matric|hr\.?\s*sec|higher secondary)\b/i;
const metricPattern = /\b20\d{2}\s*[-–]\s*(?:20\d{2}|present)\b.*\b(cgpa|per|percentage)\b|\b(cgpa|per|percentage)\b.*\b20\d{2}\s*[-–]\s*(?:20\d{2}|present)\b/i;
const projectPattern = /text analyzer|e[- ]?royal tiles|web app|website|project|streamlit|front[- ]?end|back[- ]?end/i;
const projectNamePenalty = /tiles|analyzer|website|project|school|university|college|company|edtech|summary|experience|skills|education/i;

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
  ["Python", /\bpython\b/i],
  ["C#", /\bc#\b|c sharp/i],
  [".NET", /\.net\b|dotnet/i],
  ["Spring Boot", /spring boot/i],
  ["SQL", /\bsql\b/i],
  ["MySQL", /\bmysql\b/i],
  ["PostgreSQL", /postgresql|\bpostgres\b/i],
  ["MongoDB", /mongodb/i],
  ["HTML", /\bhtml5?\b/i],
  ["CSS", /\bcss3?\b/i],
  ["JavaScript", /javascript|\bjs\b/i],
  ["TypeScript", /typescript/i],
  ["Angular", /\bangular\b/i],
  ["React", /\breact\b/i],
  ["Next.js", /next\.?js/i],
  ["Node.js", /node\.?js/i],
  ["PHP", /\bphp\b/i],
  ["REST APIs", /rest(?:ful)?\s+api|rest api|api development/i],
  ["Git", /\bgit\b|github/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /kubernetes|\bk8s\b/i],
  ["AWS", /\baws\b|amazon web services/i],
  ["Azure", /\bazure\b/i],
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
  ["Communication", /communication|verbal|written|student|parent/i],
  ["Problem Solving", /problem[- ]solving|problem solving/i],
  ["Teamwork", /teamwork|collaboration|cross[- ]functional|coordinat/i],
  ["Data Entry", /data entry/i],
  ["Adaptability", /adaptability|adaptable/i],
  ["Time Management", /time management|multitasking/i],
];

const rolePriority: Record<ResumeRole, string[]> = {
  "manual-testing": [
    "Manual Testing", "Test Cases", "Functional Testing", "Regression Testing", "Smoke Testing", "Sanity Testing",
    "Bug / Defect Tracking", "STLC", "SDLC", "SQL", "Selenium", "Automation Testing", "API Testing", "Postman",
    "Jira", "Java", "Git", "Documentation", "Problem Solving", "Communication", "Teamwork",
  ],
  "software-developer": [
    "Python", "Java", "JavaScript", "TypeScript", "Angular", "React", "Next.js", "Node.js", "C#", ".NET",
    "Spring Boot", "SQL", "MySQL", "PostgreSQL", "MongoDB", "HTML", "CSS", "PHP", "REST APIs", "Git",
    "Docker", "Kubernetes", "AWS", "Azure", "Problem Solving", "Teamwork", "Communication", "Documentation",
  ],
  "technical-support": [
    "Technical Support", "Troubleshooting", "Windows", "Linux", "Networking", "Active Directory", "Ticketing",
    "Customer Support", "Documentation", "MS Office", "Problem Solving", "Communication", "Teamwork", "Data Entry",
    "Adaptability", "Time Management",
  ],
};

function clean(value: string) {
  return value
    .replace(/[•●▪◦]/g, "-")
    .replace(/[\u00a0\uFFFE\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[-*]\s*/, "")
    .trim();
}

function lines(text: string) {
  return text.replace(/\r/g, "\n").split(/\n+/).map(clean).filter(Boolean);
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function keywordLabels(text: string) {
  return keywordCatalog.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function keywordPattern(label: string) {
  return keywordCatalog.find(([name]) => name === label)?.[1];
}

function sectionLines(resume: TailoredResume, heading: string) {
  return resume.sections.find((section) => section.heading === heading)?.lines || [];
}

function looksLikeName(line: string) {
  if (line.length < 3 || line.length > 55) return false;
  if (/@|https?:|linkedin|github|\d{6,}/i.test(line)) return false;
  if (headingPattern.test(line) || degreePattern.test(line) || institutionPattern.test(line) || projectNamePenalty.test(line)) return false;
  if (/[,:;!?]$/.test(line) || /\.$/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Z][A-Za-z'-]*$/.test(word) || /^[A-Z]$/.test(word));
}

function recoverName(baseText: string, fallback: string) {
  const candidates = lines(baseText).filter(looksLikeName);
  if (candidates.length) {
    return candidates
      .map((line, index) => {
        const words = line.split(/\s+/);
        let score = line === line.toUpperCase() ? 5 : 2;
        if (words.some((word) => /^[A-Z]$/.test(word))) score += 7;
        if (words.length === 2 || words.length === 3) score += 2;
        if (/-/.test(line)) score -= 2;
        return { line, score, index };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)[0].line;
  }
  if (looksLikeName(fallback)) return fallback;
  return "Candidate";
}

function recoverContact(baseText: string, fallback: string) {
  const source = baseText.replace(/(linkedin\.com\/in\/[A-Za-z0-9-]+-)\s+(\d{5,12})/gi, "$1$2");
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const linkedIn = source.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+/i)?.[0] || "";
  const withoutUrls = source.replace(/https?:\/\/\S+/gi, " ");
  const phone = withoutUrls.match(/\b[6-9]\d{9}\b/)?.[0] || "";
  const location = source.match(/\b(Chennai|Coimbatore|Madurai|Bengaluru|Bangalore|Kerala|Tamil Nadu|India)\b/i)?.[0] || "";
  const recovered = [location, email, phone, linkedIn].filter(Boolean).join(" | ");
  return recovered || fallback;
}

function overlapScore(value: string, jd: string) {
  let score = 0;
  for (const [, pattern] of keywordCatalog) {
    if (pattern.test(jd) && pattern.test(value)) score += 5;
  }
  const tokens = new Set(jd.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter((token) => token.length >= 5));
  for (const token of value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/)) {
    if (tokens.has(token)) score += 1;
  }
  return score;
}

function rank(values: string[], jd: string) {
  return values
    .map((value, index) => ({ value, index, score: overlapScore(value, jd) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.value);
}

function recoverExperience(baseText: string, fallback: string[], jd: string) {
  const source = lines(baseText);
  const title = source.find((line) => strictRolePattern.test(line) && line.length <= 100)
    || fallback.find((line) => strictRolePattern.test(line) && line.length <= 100)
    || "";

  const bullets: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const line = source[index];
    if (!actionPattern.test(line)) continue;
    let item = line;
    let cursor = index + 1;
    while (cursor < source.length && !/[.!?]$/.test(item) && item.length < 260) {
      const next = source[cursor];
      if (headingPattern.test(next) || strictRolePattern.test(next) || actionPattern.test(next) || degreePattern.test(next) || projectPattern.test(next)) break;
      if (next.length <= 2) break;
      item = `${item} ${next}`.replace(/\s{2,}/g, " ").trim();
      cursor += 1;
    }
    bullets.push(item);
  }

  const fallbackBullets = fallback.filter((line) => actionPattern.test(clean(line)));
  const ordered = rank(dedupe([...bullets, ...fallbackBullets]), jd).slice(0, 5);
  return [title, ...ordered].filter(Boolean);
}

function recoverEducation(baseText: string, fallback: string[]) {
  const source = lines(baseText);
  const degrees = source.filter((line) => degreePattern.test(line) && institutionPattern.test(line));
  const metrics = source.filter((line) => metricPattern.test(line));

  if (degrees.length && metrics.length === degrees.length) {
    return degrees.slice(0, 4).map((degree, index) => `${degree} | ${metrics[index]}`);
  }

  const completeFallback = fallback
    .map(clean)
    .filter((line) => degreePattern.test(line) && /20\d{2}\s*[-–]\s*(?:20\d{2}|present)/i.test(line));
  if (completeFallback.length) return dedupe(completeFallback).slice(0, 4);

  // If extraction is incomplete, keep the degree/institution text without shifting a date or score to the wrong qualification.
  return dedupe(degrees).slice(0, 4);
}

function recoverProjects(baseText: string, fallback: string[], jd: string) {
  const sourceProjects = lines(baseText)
    .filter((line) => projectPattern.test(line))
    .filter((line) => line.length >= 20)
    .filter((line) => !headingPattern.test(line));
  return rank(dedupe([...sourceProjects, ...fallback.map(clean)]), jd).slice(0, 2);
}

function cleanExistingSkillLines(values: string[]) {
  return dedupe(values.map(clean).filter((line) => line.length >= 2 && line.length <= 64 && line.split(/\s+/).length <= 9));
}

function recoverSkills(baseText: string, jd: string, role: ResumeRole, fallback: string[]) {
  const jdKeywords = keywordLabels(jd);
  const baseKeywords = new Set(keywordLabels(baseText));
  const priority = new Map(rolePriority[role].map((label, index) => [label, index]));
  const existing = cleanExistingSkillLines(fallback);

  const matchedJd = jdKeywords
    .filter((label) => baseKeywords.has(label))
    .sort((a, b) => (priority.get(a) ?? 999) - (priority.get(b) ?? 999));

  const displayMatched = matchedJd.map((label) => {
    const pattern = keywordPattern(label);
    const original = pattern ? existing.find((skill) => pattern.test(skill)) : undefined;
    return original || label;
  });

  const roleVerified = rolePriority[role]
    .filter((label) => baseKeywords.has(label))
    .map((label) => {
      const pattern = keywordPattern(label);
      const original = pattern ? existing.find((skill) => pattern.test(skill)) : undefined;
      return original || label;
    });

  const jdPhraseSkills = existing.filter((skill) => overlapScore(skill, jd) > 0);
  const generalFallback = existing.filter((skill) => /communication|ms office|data entry|adaptability|time management|multitasking|team/i.test(skill));
  return dedupe([...displayMatched, ...jdPhraseSkills, ...roleVerified, ...generalFallback]).slice(0, 6);
}

function listPhrase(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildSummary(baseText: string, jd: string, role: ResumeRole, target: string) {
  const qualification = /\bM\.?\s*C\.?\s*A\b/i.test(baseText) ? "MCA graduate" : "Candidate";
  const baseKeywords = new Set(keywordLabels(baseText));
  const priority = rolePriority[role];
  const matched = keywordLabels(jd)
    .filter((label) => baseKeywords.has(label))
    .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
    .slice(0, 4);
  const skillsText = listPhrase(matched);
  const hasProjects = /text analyzer|e[- ]?royal tiles|web app|website|developed|built/i.test(baseText);

  if (role === "software-developer") {
    const first = hasProjects
      ? `${qualification} with hands-on academic project experience in web application development${skillsText ? ` and relevant skills in ${skillsText}` : ""}.`
      : `${qualification} with a practical foundation in software development${skillsText ? ` and relevant skills in ${skillsText}` : ""}.`;
    return `${first} Brings professional communication and coordination experience, with a structured approach to problem solving. Seeking the ${target} role to contribute to software delivery and grow in the technologies required by the position.`;
  }

  if (role === "manual-testing") {
    const first = `${qualification} pursuing the ${target} role${skillsText ? ` with a foundation in ${skillsText}` : " and a strong interest in software quality"}.`;
    return `${first} Brings documentation, communication and process-coordination experience, supporting a detail-oriented and methodical approach to QA.`;
  }

  const first = `${qualification} pursuing the ${target} role${skillsText ? ` with relevant strengths in ${skillsText}` : " and a service-oriented technical foundation"}.`;
  return `${first} Brings professional communication, documentation and coordination experience, supporting organized and responsive technical support.`;
}

function withSection(sections: ResumeSection[], heading: string, values: string[]) {
  const next = sections.filter((section) => section.heading !== heading);
  if (values.length) next.push({ heading, lines: values });
  return next;
}

export function structureTailoredResumeForJd(
  baseText: string,
  jobDescription: string,
  role: ResumeRole,
  target: string,
  resume: TailoredResume,
) {
  const jd = jobDescription.trim();
  const candidateName = recoverName(baseText, resume.candidateName);
  const contactLine = recoverContact(baseText, resume.contactLine);
  const experience = recoverExperience(baseText, sectionLines(resume, "EXPERIENCE"), jd);
  const education = recoverEducation(baseText, sectionLines(resume, "EDUCATION"));
  const projects = recoverProjects(baseText, sectionLines(resume, "PROJECTS"), jd);
  const skills = recoverSkills(baseText, jd, role, sectionLines(resume, "SKILLS"));
  const summary = buildSummary(baseText, jd, role, target);

  let sections = resume.sections;
  sections = withSection(sections, "EXPERIENCE", experience);
  sections = withSection(sections, "SKILLS", skills);
  sections = withSection(sections, "EDUCATION", education);
  sections = withSection(sections, "PROJECTS", projects);

  const preferredOrder = ["EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS"];
  sections = [...sections].sort((a, b) => {
    const left = preferredOrder.indexOf(a.heading);
    const right = preferredOrder.indexOf(b.heading);
    return (left < 0 ? 999 : left) - (right < 0 ? 999 : right);
  });

  const plainText = [
    candidateName,
    target,
    contactLine,
    "",
    "SUMMARY",
    summary,
    "",
    ...sections.flatMap((section) => [section.heading, ...section.lines, ""]),
  ].join("\n");

  const structuredResume: TailoredResume = {
    ...resume,
    candidateName,
    contactLine,
    roleLabel: target,
    summary,
    sections,
    plainText,
  };

  const jdKeywords = dedupe(keywordLabels(jd));
  const matchedKeywords = jdKeywords.filter((label) => keywordPattern(label)?.test(baseText));
  const missingKeywords = jdKeywords.filter((label) => !matchedKeywords.includes(label));

  return { resume: structuredResume, jdKeywords, matchedKeywords, missingKeywords };
}
