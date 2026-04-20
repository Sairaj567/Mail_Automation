# Campus Hiring Automation Platform: An IEEE-Style Project Report

## Title
Campus Hiring Automation Platform: Workflow-Centric Placement Email Processing, Job Lifecycle Management, and Student Application Automation Using Express, EJS, MongoDB, and n8n

## Authors
Saira (Project Owner)

## Date
April 4, 2026

## Abstract
This report presents the design and implementation of a Campus Hiring Automation Platform developed to reduce manual effort in college placement workflows. The system addresses a common institutional challenge: unstructured opportunity intake through email, delayed job posting, inconsistent candidate tracking, and poor integration between internal records and external automation tools. The implemented solution uses a Node.js Express application with server-rendered EJS interfaces, MongoDB persistence through Mongoose, and webhook-based integration with n8n for workflow automation.

The platform operationalizes a complete placement pipeline with role-based portals for students, companies, and administrators. Students discover opportunities, maintain profiles, apply with resume fallback logic, and track application status. Companies ingest profiles and jobs either manually or through n8n webhook payloads. Administrators moderate incoming jobs and trigger downstream synchronization on activation. The system emphasizes resilient integration behavior: core transactions complete even when external webhook endpoints are unavailable.

The implementation includes guarded write operations for demo users, normalized payload handling for unreliable integration inputs, and structured JSON response contracts for API reliability. Automated tests validate critical behaviors including webhook secret enforcement, fault tolerance under integration failures, application submission continuity, and admin activation sync paths. The resulting platform is suitable for phased deployment in educational institutions seeking deterministic placement workflows while retaining extensibility for future AI-based ranking, resume intelligence, and analytics refinement.

Keywords: placement automation, campus recruitment, Express.js, MongoDB, n8n, webhook integration, role-based access control, EJS, workflow reliability

## I. Introduction
Campus placement cells process high volumes of heterogeneous communication from recruiters, training partners, and external event organizers. Traditional manual triage methods produce latency, missed opportunities, and non-standard candidate communication. These issues become severe when one administrator or a small committee manages intake for multiple departments.

The Campus Hiring Automation Platform targets this gap by introducing structured opportunity management on top of operational workflows already used in colleges. Instead of replacing institutional processes, the system codifies them through explicit role boundaries, data validation, and automation hooks.

The key design goals were:
1. Convert fragmented placement operations into a single transactional workflow.
2. Preserve usability for non-technical stakeholders through server-rendered pages.
3. Enforce predictable security and data hygiene at route and payload boundaries.
4. Support gradual automation through optional n8n integrations.
5. Maintain continuity when external systems fail.

## II. Problem Statement and Objectives
### A. Problem Statement
The placement office receives a continuous stream of opportunities and requests in different formats. Without a controlled data lifecycle:
- Job metadata is inconsistent.
- Application records fragment across spreadsheets, emails, and chats.
- Student profiles must be re-entered repeatedly.
- Company follow-up becomes delayed and error-prone.
- Monitoring conversion and shortlist outcomes is difficult.

### B. Project Objectives
The implemented system delivers the following operational outcomes:
1. Centralized role-aware portal for student, company, and admin workflows.
2. Structured data models for users, jobs, applications, and profiles.
3. Controlled job publication lifecycle with explicit admin activation.
4. Robust student application flow with resume fallback from profile storage.
5. Webhook-driven synchronization to external workflow engines and sheets.
6. Test-backed reliability across core integration and moderation scenarios.

## III. Scope and Contributions
### A. In-Scope Contributions
1. Full-stack monolithic deployment with Express, EJS, and Mongoose.
2. Session-backed authentication and role-based route protection.
3. Company profile and job ingestion endpoints under /api/n8n.
4. Student application persistence with enriched applicant details.
5. Integration hooks for application sync and resume Drive upload.
6. Admin controls for pending job review, activation, and deletion.

### B. Out-of-Scope (Current Runtime)
1. Prisma/PostgreSQL migration path documentation exists but is not the active runtime stack.
2. Advanced AI ranking and ATS-level scoring are planned but not production-grounded in the current implementation.
3. Full event-based observability and distributed tracing are not yet implemented.

## IV. System Architecture
### A. Runtime Topology
The active server entrypoint is server/server.js. The application is an Express 5 monolith with:
- Helmet for baseline HTTP security headers.
- Morgan for request logging.
- JSON and URL-encoded body parsing.
- Session persistence via express-session and connect-mongo.
- EJS template rendering with route-driven page composition.

Static and generated content is served through deterministic mounts:
1. public/ served at root.
2. client/css served at /css.
3. client/js served at /js.
4. public/uploads served at /uploads.

### B. Layered Organization
1. Routers: role checks, middleware, endpoint registration, and upload wiring.
2. Controllers: business logic, EJS rendering, JSON response generation.
3. Models: Mongoose schemas, constraints, and persistence behavior.
4. Views: role-specific UI pages and layout composition.

### C. Error and Response Strategy
A global error middleware distinguishes between page and API responses:
- API or JSON-accepting requests receive JSON with success false and message.
- Page requests receive EJS-rendered error pages.
- A terminal 404 handler follows the same negotiation strategy.

This architecture avoids mixed-content failure behavior and improves frontend predictability.

## V. Data Model Design
### A. User Model
The User schema supports three roles: student, company, and admin. Password hashing is enforced with a pre-save hook using bcryptjs. Authentication uses comparePassword for secure credential checks.

### B. Job Model
The Job schema defines structured job metadata including:
- title, company, location, salary, description.
- jobType enum: internship, full-time, part-time, remote.
- experienceLevel enum: fresher, 0-2, 2-5, 5+.
- isActive for moderation lifecycle.
- postedBy relation to company user identity.

### C. Application Model
Application is an enriched transactional record containing:
1. Student and Job references.
2. personalInfo block.
3. education block with completion status and scores.
4. skills, projects, extracurricular details.
5. uploaded document filenames and optional cover text.
6. status lifecycle (applied through accepted).
7. communication and interview scheduling structures.

### D. StudentProfile and CompanyProfile
StudentProfile stores longitudinal candidate metadata and saved jobs. CompanyProfile stores organization metadata, address, size band, social links, and posted job references.

The model strategy separates account identity from domain profiles, enabling cleaner role-specific expansion.

## VI. Core Workflow Implementation
### A. Student Workflow
1. Student logs in and lands in role-protected routes.
2. Job details rendering computes quick-apply eligibility through stored resume and core profile completeness.
3. Application submission checks duplicate applications by job and student.
4. Resume handling uses uploaded file when present, otherwise reuses profile resume.
5. Application record is persisted before external sync attempts.
6. Optional webhooks are triggered for Drive upload and sheet synchronization.

A key reliability decision is fail-soft sync behavior: application persistence succeeds even when webhook calls fail.

### B. Company Workflow
1. Company users can maintain profile and post jobs manually.
2. n8n payloads can upsert company identity and profile.
3. Job ingestion normalizes noisy fields such as job type, experience text, and multi-value requirement strings.
4. Ingested jobs are attached to company profile and remain pending admin activation.

### C. Admin Workflow
1. Pending and active jobs are reviewed through admin routes.
2. Activation updates job lifecycle state and attempts downstream sync.
3. Deletion and approved-job removal also reconcile company profile job references.
4. JSON and page consumers are both supported through response negotiation.

## VII. Integration and Automation Design
### A. n8n Endpoints
The platform exposes:
1. POST /api/n8n/company-profile
2. POST /api/n8n/jobs
3. POST /api/n8n/company-job

Each endpoint validates optional shared-secret headers using x-webhook-secret or x-n8n-secret when N8N_WEBHOOK_SECRET is configured.

### B. Payload Robustness
Controller utilities normalize irregular payload forms:
- Text cleanup and placeholder handling.
- Multi-value splitting from comma/newline-delimited fields.
- Job type and experience canonicalization.
- Safe date parsing for application deadlines.

### C. Student Application Sync
On student apply:
1. Local resume URL is built using APP_BASE_URL if configured, otherwise a default public base URL.
2. Resume Drive upload webhook is attempted first when configured.
3. Sheet-maker webhook receives either Drive link or fallback hosted resume URL.

### D. Admin Activation Sync
On job activation, a webhook can be triggered through N8N_MAIL_SHEET_MAKER_WEBHOOK_URL, with fallback to N8N_JOB_APPLICATION_WEBHOOK_URL.

This design supports partial integration rollout without introducing hard failures in core business operations.

## VIII. Security, Access Control, and Reliability
### A. Access Control
- Role checks are enforced at router level.
- Unauthorized users are redirected to role-specific login routes.
- Demo-mode users are blocked from critical write actions.

### B. Session Security
- Sessions use Mongo-backed persistence.
- Secure cookie mode is enabled in production.
- HttpOnly cookies reduce client-side token exposure.

### C. Integration Security
- Shared-secret webhook validation protects ingestion endpoints.
- Missing secret configuration is explicitly logged for operator awareness.

### D. Reliability Patterns
1. Application persistence before webhook sync attempts.
2. Graceful degradation when sync endpoints are missing.
3. Diagnostic messaging in failure payloads.
4. Centralized exception handling for deterministic API responses.

## IX. Testing and Validation
The project includes node:test based suites with supertest and model/method stubbing. Tested behaviors include:

1. Student apply flow behavior when sheet webhook is absent.
2. Graceful continuation when webhook calls return error responses.
3. Resume URL generation correctness with default public base URL.
4. Validation and diagnostic error propagation on data access failures.
5. Autofill behavior using session/profile identity fallback.
6. n8n webhook secret rejection for invalid signatures.
7. Company profile creation and upsert paths for valid integration payloads.
8. Job ingestion validation for missing required fields.
9. Error surfacing on simulated Mongo write failures.
10. Admin job activation webhook triggering and fallback behavior.
11. Active-job removal logic and company profile reconciliation.
12. Route-level integration checks for n8n base endpoint and company route guards.

Overall, the tests prioritize integration reliability and operational edge cases rather than only nominal success paths.

## X. Performance and Scalability Considerations
### A. Current Performance Characteristics
1. The monolithic server and Mongo persistence are sufficient for moderate campus placement volumes.
2. Key list endpoints use sorting, limiting, and selective retrieval to avoid unbounded payload growth.
3. Profile and application data are modeled for direct read paths rather than expensive joins.

### B. Scaling Constraints
1. Single-process deployment can become CPU-bound under high concurrent traffic.
2. Synchronous webhook attempts in request lifecycle can add latency variance.
3. Analytics aggregation complexity can grow with historical records.

### C. Evolution Path
1. Introduce job queue or background worker for webhook dispatch.
2. Add index tuning for frequently filtered fields and status aggregations.
3. Externalize observability with structured logs and metrics pipelines.
4. Evaluate service decomposition once organizational workflow complexity increases.

## XI. Limitations and Risk Assessment
1. Resume analytics profile-match score is heuristic and not ATS validated.
2. Resume views are currently untracked.
3. Legacy and mixed data quality from external payloads can still affect reporting quality.
4. Public resume URL construction depends on deployment-aware APP_BASE_URL configuration.
5. The current architecture does not yet include end-to-end idempotency tokens for all webhook flows.

## XII. Conclusion
The Campus Hiring Automation Platform demonstrates a practical and production-oriented implementation of placement workflow digitization. Its strongest contribution is not only CRUD enablement, but operational reliability under imperfect integration conditions. The system combines role-based governance, explicit moderation, and resilient webhook orchestration into a coherent campus hiring lifecycle.

The current implementation is deployable for real-world placement operations, while retaining extensibility for AI-assisted ranking, richer analytics, and infrastructure hardening. By grounding automation in reliable transaction semantics and guarded route behavior, the project provides a robust foundation for institutional-scale recruitment process modernization.

## XIII. Future Work
1. End-to-end email ingestion pipeline integration for direct opportunity extraction.
2. AI-assisted resume parsing with confidence-aware match scoring.
3. Real-time dashboards for placement office throughput and conversion analysis.
4. Event-driven webhook dispatch with retry policies and dead-letter handling.
5. Fine-grained audit logs for compliance and external review.
6. Optional migration track to Prisma/PostgreSQL when multi-tenant complexity increases.

## References
[1] Express.js Documentation, https://expressjs.com/.

[2] Mongoose Documentation, https://mongoosejs.com/.

[3] Node.js Test Runner Documentation, https://nodejs.org/api/test.html.

[4] n8n Documentation, https://docs.n8n.io/.

[5] OWASP Foundation, OWASP Top Ten Web Application Security Risks, https://owasp.org/www-project-top-ten/.

[6] IEEE Author Center, IEEE Conference Templates and Formatting Guidance, https://ieeeauthorcenter.ieee.org/.

[7] MongoDB Documentation, https://www.mongodb.com/docs/.
