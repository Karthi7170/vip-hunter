# VIP-Hunter

Single-user, iPhone-friendly Next.js AI job matching engine.

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
The server-side search uses OpenAI web search, scores each JD against the verified candidate profile, rejects clear senior mismatches, and returns application URLs. It never claims unverified technical skills.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Configure required environment variables
4. `npm run dev`

The Vercel cron route is `/api/cron/daily`. `30 3 * * *` corresponds to 09:00 IST.

## WhatsApp notifications
VIP-Hunter includes a server-side Meta WhatsApp Cloud API notifier. The recipient number and Meta credentials are intentionally not committed to source code. Configure them privately as environment variables. Until the credentials and approved template are configured, the job engine continues without claiming a WhatsApp message was sent.
