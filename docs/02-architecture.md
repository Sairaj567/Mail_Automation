# System Architecture

## High-level Components

- Email Ingestion (n8n + Gmail/Outlook/IMAP)
- NLP/AI Services (classification, IE, resume parsing, matching)
- Core Backend API (Express/Node + Prisma/Postgres)
- Queue/Workers (BullMQ/Redis or RabbitMQ)
- Storage (Postgres for metadata, S3/Drive for files)
- Frontend (Admin/TPO dashboard, Student portal)
- Notification Service (Email, Slack/Teams)
- Observability (logging, metrics, tracing)

## Data Flow

1. Email hits mailbox → n8n webhook → AI classification → POST to backend `/mails`.
2. Backend stores raw mail; ETL worker extracts structured fields → creates/updates `Opportunity`.
3. TPO reviews in dashboard → approves/publishes → notifications to students.
4. Students apply → eligibility engine validates → `Application` created.
5. Auto-reply job compiles candidate pack → sends to company → tracks outcomes.

## Services

- API Service: REST (later GraphQL), auth (JWT/OAuth), RBAC, rate limiting.
- Worker Service: background jobs: parsing PDFs, matching, email sends, retries.
- AI Service: wrapper for LLMs and local models with prompt templates and guardrails.

## Tech Choices

- Node.js, Express 5, Prisma, Postgres.
- Redis + BullMQ for jobs; nodemailer for email.
- PDF parsing: PyPDF, Tika, or Node pdf-parse; skill extraction via spaCy/Transformer.
- LLMs: use provider-agnostic SDK; store prompts and outputs for audit.

## Deployment

- Dockerized services; compose or Kubernetes.
- Separate dev/stage/prod; migrations via Prisma.
- Backups for DB and file storage.

## Security

- Secrets in env vars or vault; TLS everywhere; input validation; file scanning (antivirus) for uploads.
- Audit logs and consent records.
