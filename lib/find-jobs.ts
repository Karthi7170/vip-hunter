import type { Job } from "@/lib/jobs";
function outputText(x:any){return x.output_text||x.output?.flatMap((o:any)=>o.content||[]).map((c:any)=>c.text||"").join("")||""}
function parse(text:string):Job[]{const cleaned=text.replace(/^```json\s*/i,"").replace(/```$/,"").trim();const data=JSON.parse(cleaned);return Array.isArray(data.jobs)?data.jobs:[]}
export async function findLiveJobs():Promise<Job[]>{
 if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
 const prompt=`Search the live web for CURRENT job vacancies posted within the LAST 24 HOURS for this candidate. Search broadly across credible job platforms and direct employer career pages. Do not invent jobs or URLs.

VERIFIED CANDIDATE PROFILE
- MCA, SRM University Chennai, 2023-2025, CGPA 8.5
- BCA, Sacred Heart College Vaniyambadi, 2020-2023, CGPA 6.7
- Professional experience: Business Operations Executive in EdTech; student calls/follow-ups, records/lead data/documentation, operations/admin support, internal coordination, lead generation/marketing, communication with students/parents.
- Career target: transition into Manual Testing / QA. Candidate states they learned the entire Manual Testing syllabus. Do NOT claim professional QA work experience.
- Projects: AI-Based Text Analyzer (text summarization and sentiment analysis); E-Royal Tiles Website using HTML, CSS, JavaScript, PHP and SQL.
- General skills: English communication, MS Office, data entry, adaptability, student/parent communication, time management/multitasking.
- Never invent Selenium, Postman, Jira, Java, Python, Linux, networking, Active Directory or other skills unless the vacancy can fit without claiming them.

SEARCH RULES
- Locations: Chennai OR Coimbatore OR ANY CITY IN KERALA, India.
- Work mode: prefer work-from-office/on-site. Exclude clearly remote-only roles.
- Experience: fresher / entry-level / 0-1 year. Reject roles that clearly require 2+ years.
- Salary target: INR 3-4 LPA when disclosed. Do not reject a strong role merely because salary is not disclosed.
- Shift: any.
- Company: established top-tier or credible medium-sized employers; avoid suspicious listings.
- Priority: (1) Manual Testing / QA / Software Testing / Junior Test Engineer, (2) entry-level Developer, (3) System Engineer / Technical Support / System Support.
- Deduplicate the same vacancy across sources. Prefer the direct employer application page when available.
- Score 0-100 based on verified profile vs JD. A high score must not depend on skills the candidate has not verified.
- Return strongest matches first, maximum 50.
- posted must be supported as <=24 hours; if this cannot be verified, omit that vacancy.

Return ONLY JSON:
{"jobs":[{"id":"stable-id","company":"","role":"","location":"","experience":"","mode":"On-site|Hybrid|Not specified","type":"Testing|Developer|System","fit":0,"posted":"","salary":"","matchedSkills":[""],"missingSkills":[""],"requirements":[""],"whyFit":"","applyUrl":"https://...","source":""}]}`;
 const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-5.6-luna",tools:[{type:"web_search"}],input:prompt})});
 if(!r.ok) throw new Error(`Job search failed (${r.status}): ${(await r.text()).slice(0,250)}`);
 return parse(outputText(await r.json()));
}
