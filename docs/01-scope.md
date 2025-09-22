# Scope and Features

Goal: Build a centralized platform for TPOs to manage incoming placement emails, create structured opportunities, collect student interest, auto-respond to companies with candidate packs, and continuously improve using AI.

## User Roles

- Admin (TPO/Placement Committee)
- Student
- Recruiter (optional portal, otherwise email-based)

## Core Features

### Email Ingestion & Classification

- Ingest via Gmail/Outlook webhook or IMAP. n8n flow classifies email into categories (Immediate Joining, Campus Drive, Internship, Hackathon/Competition, Pool Campus, Other).
- Deduplicate threads, extract key fields (dates, role, stipend/CTC, location, application link).
- Track processing status and SLA.

### Opportunity Management

- Convert classified emails into structured Opportunities with:
  - title, company, type, job location, mode (onsite/remote/hybrid)
  - eligibility rules (branches, graduation year, min X/10th/12th/CGPA, backlogs policy)
  - application window (start/end), selection rounds
  - attachments and original email traceability
- Approval workflow for TPO, then publish to students.

### Student Portal

- Profile: personal info, academics (10th, 12th, UG/PG), skills, internships, achievements, projects, resume(s) library.
- Dynamic Forms: per-opportunity extra questions (company-specific forms).
- Interest/Apply: capture intent, run real-time eligibility checks.
- Privacy controls: consent and visibility settings per opportunity.

### Auto-Reply & Data Packaging

- For published opportunities, collect interested and eligible students.
- Auto-generate a candidate pack (CSV + merged PDFs + summary email) and send to company.
- Support secure links with expiry for downloads.

### Resume Parsing & Matching (AI)

- Parse resume PDFs to structured JSON (education, experience, skills, projects).
- Job-opportunity extraction from email text for structured fields.
- Candidate-job matching score and explanation.
- Continuous learning: feedback from selections improves models/rules.

### Dashboards & Analytics

- Pipeline view: New mails → Classified → Opportunity → Published → Applications → Shared with Company → Outcomes.
- Metrics: response time, participation, eligibility rate, offer rate per company, popular skills.

### Governance & Security

- RBAC, audit logs, opt-in consent, retention policies.
- Templated communications; retry policies; error tracking.

### Integrations

- n8n for ingestion and classification.
- Gmail/Outlook APIs, Slack/Teams notifications.
- Google Drive/S3 for document storage.
- Optional: ATS export formats.

## Non-Goals (Phase 1)

- Full-fledged ATS for companies.
- Proctoring or test platforms.
