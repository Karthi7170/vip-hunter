# VIP-Hunter Apply Assistant

This optional Chrome/Edge extension autofills common application fields on supported public ATS pages used by VIP-Hunter.

Supported hosts:
- Lever (`jobs.lever.co`)
- Greenhouse (`boards.greenhouse.io`, `job-boards.greenhouse.io`)
- SmartRecruiters (`jobs.smartrecruiters.com`)

It intentionally does **not** run on LinkedIn, Naukri, or Indeed.

## Install locally
1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `browser-helper` folder.
6. Open the extension details and choose **Extension options**.
7. Enter only your verified application profile information and save it.

When you open a supported ATS application from VIP-Hunter, the helper attempts to fill safe text fields automatically.

## Safety boundaries
- Does not click final Submit.
- Does not solve or bypass CAPTCHA/OTP.
- Does not sign in to job platforms.
- Does not invent answers.
- Does not fill checkboxes/radio buttons/legal declarations.
- Does not upload a resume automatically yet.

Always review every field before submitting an application.
