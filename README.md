# Campus Hiring Automation Platform

A production-grade system to centralize, triage, and automate placement-related emails, create structured opportunities, collect student applications, auto-reply to companies with interested/eligible candidates, and continuously improve via AI-driven resume parsing and matching.

This repo currently runs on an Express + EJS + Mongoose stack, with Prisma docs/files kept only for a future migration path.

## Problem
Colleges receive many emails (Immediate Joining, Campus Drives, Internships, Hackathons, Pool Campus) at a central address. Manually reading, categorizing, and forwarding leads to delays and dropped opportunities.

## Solution (High-level)
- Ingest and classify all placement emails automatically (already prototyped via n8n + AI).
- Convert emails into structured Opportunities with clear eligibility and requirements.
- Provide portals for TPO/Placement Committee, Students, and Recruiters.
- Automate student interest collection, eligibility checks, and safe data sharing.
- Use AI to parse resumes, score candidates, and suggest matches.
- Track metrics and feedback loops to improve classification and matching.

## Repo Layout
- `server/server.js`: Active Express entrypoint (EJS + MongoDB sessions)
- `server.js`: Compatibility launcher that delegates to `server/server.js`
- `server/models/`: Mongoose models for users, jobs, applications, and profiles
- `docs/`: Architecture, data model, AI plan, roadmap, API spec, n8n integration

## Quick start
- Ensure MongoDB is running and optionally set `MONGODB_URI` (defaults to `mongodb://localhost:27017/placement_portal`)
- Set `SESSION_SECRET` (required; server exits on startup if missing)
- Set `N8N_JOB_APPLICATION_WEBHOOK_URL` (example: `http://localhost:5678/webhook/job-application`) if you want student applications to trigger the sheet-maker workflow
- Optional: set `N8N_MAIL_SHEET_MAKER_WEBHOOK_URL` if admin job activation should also trigger the sheet-maker workflow (falls back to `N8N_JOB_APPLICATION_WEBHOOK_URL`)
- Optional: set `APP_BASE_URL` (example: `http://localhost:3345`) so resume links sent to n8n are fully qualified
- Optional: set `N8N_RESUME_DRIVE_WEBHOOK_URL` (example: `http://localhost:5678/webhook/resume-drive-upload`) to upload resumes to Google Drive before sheet sync; this webhook should return a Drive URL in one of: `resume_drive_link`, `drive_link`, `drive_url`, or `url`
- Install dependencies with `npm install`
- Start server with `npm run dev` (or `npm start`)

> See docs for full plan and next steps.

## Current student apply behavior

- The apply flow auto-prefills key fields from session/profile data when available.
- Resume upload during apply is optional if a resume already exists in the student profile.
- If a new resume is uploaded during apply, it is used for that application and updates the profile resume.
- Quick apply is available only when required core profile data and a stored resume are present.

## Resume analytics behavior

- Applications Sent and Shortlisted are live values derived from application records.
- Profile Match Score is an estimate (profile completeness heuristic), not ATS truth.
- Resume Views are currently untracked and should be treated as not available until tracking is implemented.

## n8n webhook endpoints

The running Express server exposes webhook routes under `/api/n8n` for automation tools such as n8n. All endpoints honor the optional `N8N_WEBHOOK_SECRET` via the `x-webhook-secret` (or `x-n8n-secret`) header.

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `POST /api/n8n/company-profile` | Upsert a company `User` and `CompanyProfile`. | Requires `email` and `companyName` in the payload. Returns the created/updated `userId` and `profileId`, plus a temporary password if a new user was made. |
| `POST /api/n8n/jobs` | Ingest a job for an existing (or newly created) company. | Accepts either `title` or `jobTitle`, along with `location`, `jobType`, `salary`, and `description`. Jobs created via this route are marked inactive until activated by an admin. |
| `POST /api/n8n/company-job` | Combined company + job ingestion using a single payload. | Supports the composite payload shown in the n8n example. The handler normalizes skills/requirements to arrays, coerces deadlines into dates, and auto-links the job back to the company profile. |

Example combined payload:

```json
{
  "email": "hr@example.com",
  "companyName": "Example Corp",
  "name": "Alex Recruiter",
  "industry": "SaaS",
  "website": "https://example.com",
  "description": "SaaS platform for automation",
  "contactPerson": "Alex Recruiter",
  "phone": "+1-555-123-4567",
  "street": "123 Market St",
  "city": "San Francisco",
  "state": "CA",
  "country": "USA",
  "zipCode": "94105",
  "size": "201-500",
  "founded": 2012,
  "linkedin": "https://www.linkedin.com/company/example",
  "jobTitle": "Senior Automation Engineer",
  "location": "Remote",
  "jobType": "Full-Time",
  "salary": "$120k - $140k",
  "jobDescription": "Own our automation roadmap...",
  "skills": "Node.js, Express, MongoDB",
  "requirements": "5+ years experience, Strong automation background",
  "applicationDeadline": "2025-12-31",
  "applyLink": "https://example.com/apply"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Company profile synchronized and job ingested successfully. Job is pending admin activation.",
  "userId": "...",
  "profileId": "...",
  "jobId": "...",
  "createdUser": true,
  "createdProfile": true,
  "temporaryPassword": "abcd1234"
}
```
