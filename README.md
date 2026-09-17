# VIP-Hunter

Single-user, iPhone-friendly AI-MAD job matching engine.

## Candidate rules
- Priority: Manual Testing/QA -> Developer -> System Engineer/Support
- Location: Chennai, Coimbatore, or any city in Kerala
- Experience: fresher / 0-1 year
- Work mode: office/on-site preferred
- Salary target: INR 3-4 LPA when disclosed
- Shift: any
- Search window: jobs posted within the previous 24 hours
- Daily run: 09:00 IST (03:30 UTC)
- Up to 50 relevant matches; applications remain manual

## Engine
VIP-Hunter no longer requires OpenAI API credits for job discovery. The server scans public employer ATS feeds from Lever and SmartRecruiters, filters to the target locations and role families, rejects clear senior/2+ year mismatches, deduplicates vacancies, and scores them locally against the verified candidate profile.

The current free scan covers a curated set of credible employers using public ATS feeds. It does not claim to cover every job board or every employer on the web, and it does not fabricate vacancies when no recent eligible jobs are found.

Verified candidate skills are used for positive matching. Requirements such as Selenium, Postman, Jira, Java, Python, Linux, networking, Active Directory, Cypress, Playwright, API testing, and automation testing are shown as unverified gaps unless separately confirmed.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Configure the Supabase variables and other optional integrations
4. `npm run dev`

No `OPENAI_API_KEY` is required for the free ATS job scan.

The Vercel cron route is `/api/cron/daily`. `30 3 * * *` corresponds to 09:00 IST.

## WhatsApp notifications
VIP-Hunter includes a server-side Meta WhatsApp Cloud API notifier. The recipient number and Meta credentials are intentionally not committed to source code. Configure them privately as environment variables. Until the credentials and approved template are configured, the job engine continues without claiming a WhatsApp message was sent.
