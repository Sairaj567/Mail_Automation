# Roadmap & Milestones

## Phase 0: Foundations (week 1-2)

- Harden `/mails` API (validation, auth).
- Add DB models (Company, Opportunity, Student, Application).
- Minimal admin UI (or Postman) to create Opportunities.

## Phase 1: Publish Opportunities (week 3-4)

- ETL from Mail → Opportunity.
- Approval flow; publish and notify students.
- Student registration + profile; simple apply.

## Phase 2: Eligibility & Auto-Reply (week 5-6)

- Eligibility engine (rules + profile checks).
- Generate candidate pack; auto-reply email to company.
- Track outcomes (shortlist/offer) and feedback.

## Phase 3: AI Enhancements (week 7-8)

- Resume parsing pipeline and scoring.
- Matching explanation; dashboards.
- Human-in-loop correction UI for IE.

## Phase 4: Polish & Ops (week 9+)

- RBAC, audit logs, rate limits, retries.
- CI/CD, backups; observability; docs and demo script.
