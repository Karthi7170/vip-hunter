import type { Job, JobType } from "@/lib/jobs";

const SEARCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 50;

const leverBoards = [
  { slug: "valgenesis", name: "ValGenesis" },
  { slug: "extremenetworks", name: "Extreme Networks" },
  { slug: "brillio-2", name: "Brillio" },
  { slug: "pditechnologies", name: "PDI Technologies" },
  { slug: "propelsoftware", name: "Propel Software Solutions" },
  { slug: "reply", name: "Reply" },
  { slug: "cprime", name: "Cprime" },
];

const smartRecruitersBoards = [
  { id: "Freshworks", name: "Freshworks" },
  { id: "Sutherland", name: "Sutherland" },
  { id: "NielsenIQ", name: "NielsenIQ" },
  { id: "BoschGroup", name: "Bosch Group" },
  { id: "KumaranSystemsPrivateLimited", name: "Kumaran Systems" },
  { id: "Eurofins", name: "Eurofins" },
  { id: "Hubfly2", name: "Hubfly" },
  { id: "SurajTechnologies", name: "Suraj Technologies" },
  { id: "PinnacleSevenTechnologies", name: "Pinnacle Seven Technologies" },
];

// State names catch ATS records that include the region. City aliases catch feeds
// that publish only a city name without Tamil Nadu / Kerala in the location string.
const tamilNaduPlaces = [
  "tamil nadu",
  "tamilnadu",
  "chennai",
  "coimbatore",
  "madurai",
  "tiruchirappalli",
  "trichy",
  "salem",
  "tiruppur",
  "tirupur",
  "erode",
  "vellore",
  "tirunelveli",
  "thoothukudi",
  "tuticorin",
  "dindigul",
  "thanjavur",
  "nagercoil",
  "kanchipuram",
  "kancheepuram",
  "karur",
  "cuddalore",
  "sivakasi",
  "kumbakonam",
  "rajapalayam",
  "pudukkottai",
  "pudukottai",
  "ambur",
  "ranipet",
  "tiruvannamalai",
  "pollachi",
  "namakkal",
  "krishnagiri",
  "dharmapuri",
  "udhagamandalam",
  "ooty",
  "avadi",
  "tambaram",
  "sriperumbudur",
  "hosur",
  "neyveli",
  "nagapattinam",
  "mayiladuthurai",
  "viluppuram",
  "villupuram",
  "virudhunagar",
  "sivaganga",
  "ramanathapuram",
  "tenkasi",
  "theni",
  "perambalur",
  "ariyalur",
  "tirupattur",
];

const keralaPlaces = [
  "kerala",
  "kochi",
  "cochin",
  "ernakulam",
  "kakkanad",
  "aluva",
  "angamaly",
  "thiruvananthapuram",
  "trivandrum",
  "kozhikode",
  "calicut",
  "thrissur",
  "trichur",
  "kollam",
  "quilon",
  "kottayam",
  "palakkad",
  "palghat",
  "alappuzha",
  "alleppey",
  "kannur",
  "cannanore",
  "malappuram",
  "kasaragod",
  "kasargod",
  "pathanamthitta",
  "idukki",
  "wayanad",
  "kalpetta",
  "manjeri",
  "perinthalmanna",
  "tirur",
  "kottakkal",
  "thalassery",
  "payyanur",
  "cherthala",
  "muvattupuzha",
  "kothamangalam",
  "irinjalakuda",
  "guruvayur",
  "technopark",
  "infopark",
];

const bengaluruPlaces = ["bengaluru", "bangalore"];
const targetPlaces = [...tamilNaduPlaces, ...keralaPlaces, ...bengaluruPlaces];

const entrySignals = ["fresher", "entry level", "entry-level", "graduate", "trainee", "junior", "associate", "engineer i", "engineer 1"];
const seniorTitle = /\b(senior|sr\.?|lead|staff|principal|manager|architect|director|head|engineer\s+(ii|iii|iv)|level\s*[2-9])\b/i;

function stripHtml(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "VIP-Hunter/1.0 public-job-feed",
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function withinSearchWindow(value: string | number | undefined) {
  if (!value) return false;
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp <= SEARCH_WINDOW_MS;
}

function classifyRole(title: string): JobType | null {
  const t = title.toLowerCase();
  if (/\b(qa|quality assurance|software test|test engineer|tester|testing|sdet)\b/.test(t)) return "Testing";
  if (/\b(software engineer|software developer|developer|frontend|front-end|backend|back-end|fullstack|full stack|web developer|application engineer)\b/.test(t)) return "Developer";
  if (/\b(system engineer|systems engineer|technical support|support engineer|system support|it support|service desk|help desk|helpdesk)\b/.test(t)) return "System";
  return null;
}

function locationAllowed(location: string) {
  const text = location.toLowerCase();
  return targetPlaces.some((place) => text.includes(place));
}

function detectMode(value: string | undefined, location = "") {
  const text = `${value || ""} ${location}`.toLowerCase();
  if (/remote/.test(text) && !/hybrid/.test(text)) return "Remote";
  if (/hybrid/.test(text)) return "Hybrid";
  if (/on[- ]?site|onsite|office/.test(text)) return "On-site";
  return "Not specified";
}

function clearlyRequiresTwoPlusYears(text: string) {
  const source = text.toLowerCase();
  const ranges = [...source.matchAll(/\b(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:\+\s*)?(?:years?|yrs?)\b/g)];
  if (ranges.some((match) => Number(match[1]) >= 2)) return true;

  const minimums = [...source.matchAll(/\b(?:minimum(?: of)?|at least|minimum experience(?: of)?|experience(?: of)?|requires?)\s*(\d+)\s*\+?\s*(?:years?|yrs?)\b/g)];
  if (minimums.some((match) => Number(match[1]) >= 2)) return true;

  const plusYears = [...source.matchAll(/\b(\d+)\s*\+\s*(?:years?|yrs?)\b/g)];
  return plusYears.some((match) => Number(match[1]) >= 2);
}

function experienceLabel(text: string, title: string) {
  const range = text.match(/\b(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:years?|yrs?)\b/i);
  if (range) return `${range[1]}–${range[2]} yr`;
  const one = text.match(/\b(\d+)\s*\+?\s*(?:years?|yrs?)\b/i);
  if (one) return `${one[1]}${text.includes(`${one[1]}+`) ? "+" : ""} yr`;
  if (entrySignals.some((signal) => `${title} ${text}`.toLowerCase().includes(signal))) return "Fresher / 0–1 yr";
  return "Not disclosed";
}

function getSkills(description: string) {
  const text = description.toLowerCase();
  const verified: Array<[string, RegExp]> = [
    ["Manual Testing", /manual test|functional test|test cases?|software testing/],
    ["HTML", /\bhtml5?\b/],
    ["CSS", /\bcss3?\b/],
    ["JavaScript", /\bjavascript\b|\bjs\b/],
    ["PHP", /\bphp\b/],
    ["SQL", /\bsql\b/],
    ["English Communication", /communication|written and verbal|verbal and written/],
    ["MS Office", /microsoft office|ms office|\bexcel\b|\bword\b/],
    ["Documentation", /documentation|documenting|records/],
  ];
  const unverified: Array<[string, RegExp]> = [
    ["Selenium", /selenium/],
    ["Postman", /postman/],
    ["Jira", /\bjira\b/],
    ["Java", /\bjava\b/],
    ["Python", /\bpython\b/],
    ["Linux", /\blinux\b/],
    ["Networking", /networking|tcp\/ip|layer\s*[23]/],
    ["Active Directory", /active directory/],
    ["Cypress", /cypress/],
    ["Playwright", /playwright/],
    ["API Testing", /api testing|rest assured/],
    ["Automation Testing", /automation testing|test automation|automated testing/],
  ];

  return {
    matched: verified.filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
    missing: unverified.filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
  };
}

function scoreJob(type: JobType, title: string, mode: string, matched: string[], missing: string[]) {
  let score = type === "Testing" ? 58 : type === "Developer" ? 50 : 48;
  score += 12;
  score += 8;
  if (mode === "On-site") score += 8;
  else if (mode === "Hybrid") score += 4;
  else if (mode === "Not specified") score += 2;
  if (entrySignals.some((signal) => title.toLowerCase().includes(signal))) score += 8;
  score += Math.min(12, matched.length * 3);
  score -= Math.min(20, missing.length * 4);
  return Math.max(0, Math.min(96, score));
}

function buildWhyFit(type: JobType, matched: string[], missing: string[]) {
  const roleReason = type === "Testing"
    ? "Strong priority match for the Manual Testing / QA transition."
    : type === "Developer"
      ? "Secondary target match for an entry-level software development path."
      : "Tertiary target match for system / technical support work.";
  const matchedReason = matched.length ? ` Verified overlap: ${matched.join(", ")}.` : "";
  const gapReason = missing.length ? ` Unverified requirements to review: ${missing.join(", ")}.` : "";
  return `${roleReason}${matchedReason}${gapReason}`.trim();
}

function toPosted(value: string | number) {
  const date = new Date(typeof value === "number" ? value : Date.parse(value));
  return date.toISOString();
}

type LeverPosting = {
  id: string;
  text: string;
  createdAt?: number;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  additional?: string;
  workplaceType?: string;
  categories?: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
  };
  lists?: Array<{ text?: string; content?: string }>;
};

async function scanLever(board: { slug: string; name: string }): Promise<Job[]> {
  const postings = await fetchJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${board.slug}?mode=json`);
  const jobs: Job[] = [];

  for (const posting of postings) {
    if (!posting.createdAt || !withinSearchWindow(posting.createdAt)) continue;
    if (seniorTitle.test(posting.text)) continue;

    const type = classifyRole(posting.text);
    if (!type) continue;

    const location = posting.categories?.location || "Not disclosed";
    if (!locationAllowed(location)) continue;

    const mode = detectMode(posting.workplaceType, location);
    if (mode === "Remote") continue;

    const description = stripHtml([
      posting.descriptionPlain,
      posting.description,
      posting.additionalPlain,
      posting.additional,
      ...(posting.lists || []).flatMap((item) => [item.text, item.content]),
    ].filter(Boolean).join(" "));

    if (clearlyRequiresTwoPlusYears(`${posting.text} ${description}`)) continue;

    const { matched, missing } = getSkills(description);
    const fit = scoreJob(type, posting.text, mode, matched, missing);
    if (fit < 65) continue;

    jobs.push({
      id: `lever-${board.slug}-${posting.id}`,
      company: board.name,
      role: posting.text,
      location,
      experience: experienceLabel(description, posting.text),
      mode,
      type,
      fit,
      posted: toPosted(posting.createdAt),
      matchedSkills: matched,
      missingSkills: missing,
      requirements: [...new Set([...matched, ...missing])],
      whyFit: buildWhyFit(type, matched, missing),
      applyUrl: posting.applyUrl || posting.hostedUrl || `https://jobs.lever.co/${board.slug}/${posting.id}`,
      source: "Lever public ATS",
    });
  }

  return jobs;
}

type SmartListPosting = {
  id: string;
  uuid?: string;
  name: string;
  releasedDate?: string;
  ref?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    hybrid?: boolean;
  };
};

type SmartDetail = SmartListPosting & {
  applyUrl?: string;
  jobAd?: {
    sections?: Record<string, { text?: string } | undefined>;
  };
};

function smartLocation(posting: SmartListPosting) {
  return [posting.location?.city, posting.location?.region, posting.location?.country]
    .filter(Boolean)
    .join(", ") || "Not disclosed";
}

async function scanSmartRecruiters(board: { id: string; name: string }): Promise<Job[]> {
  const list = await fetchJson<{ content?: SmartListPosting[] }>(
    `https://api.smartrecruiters.com/v1/companies/${board.id}/postings?limit=100&offset=0&destination=PUBLIC`,
  );
  const candidates = (list.content || []).filter((posting) => {
    if (!posting.releasedDate || !withinSearchWindow(posting.releasedDate)) return false;
    if (seniorTitle.test(posting.name)) return false;
    if (!classifyRole(posting.name)) return false;
    return locationAllowed(smartLocation(posting));
  }).slice(0, 20);

  const details = await Promise.allSettled(
    candidates.map((posting) =>
      fetchJson<SmartDetail>(`https://api.smartrecruiters.com/v1/companies/${board.id}/postings/${posting.uuid || posting.id}`),
    ),
  );

  const jobs: Job[] = [];
  details.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const posting = result.value;
    const fallback = candidates[index];
    const title = posting.name || fallback.name;
    const type = classifyRole(title);
    if (!type) return;

    const location = smartLocation(posting.location ? posting : fallback);
    const remote = posting.location?.remote ?? fallback.location?.remote;
    const hybrid = posting.location?.hybrid ?? fallback.location?.hybrid;
    const mode = remote ? "Remote" : hybrid ? "Hybrid" : "On-site";
    if (mode === "Remote") return;

    const sections = posting.jobAd?.sections || {};
    const description = stripHtml(Object.values(sections).map((section) => section?.text || "").join(" "));
    if (clearlyRequiresTwoPlusYears(`${title} ${description}`)) return;

    const { matched, missing } = getSkills(description);
    const fit = scoreJob(type, title, mode, matched, missing);
    if (fit < 65) return;

    const releasedDate = posting.releasedDate || fallback.releasedDate;
    if (!releasedDate) return;

    jobs.push({
      id: `smartrecruiters-${board.id}-${posting.uuid || posting.id || fallback.id}`,
      company: board.name,
      role: title,
      location,
      experience: experienceLabel(description, title),
      mode,
      type,
      fit,
      posted: toPosted(releasedDate),
      matchedSkills: matched,
      missingSkills: missing,
      requirements: [...new Set([...matched, ...missing])],
      whyFit: buildWhyFit(type, matched, missing),
      applyUrl: posting.applyUrl || fallback.ref || `https://jobs.smartrecruiters.com/${board.id}`,
      source: "SmartRecruiters public ATS",
    });
  });

  return jobs;
}

export async function findLiveJobs(): Promise<Job[]> {
  const scans = await Promise.allSettled([
    ...leverBoards.map(scanLever),
    ...smartRecruitersBoards.map(scanSmartRecruiters),
  ]);

  const combined = scans.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const deduped = new Map<string, Job>();

  for (const job of combined) {
    const key = `${job.company}|${job.role}|${job.location}`.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || job.fit > existing.fit) deduped.set(key, job);
  }

  return [...deduped.values()]
    .sort((a, b) => b.fit - a.fit || Date.parse(b.posted) - Date.parse(a.posted))
    .slice(0, MAX_RESULTS);
}
