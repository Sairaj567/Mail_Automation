# Campus Hiring Automation Platform

A production-grade system to centralize, triage, and automate placement-related emails, create structured opportunities, collect student applications, auto-reply to companies with interested/eligible candidates, and continuously improve via AI-driven resume parsing and matching.

This repo contains a minimal Express + Prisma backend and project docs to guide the full build.

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
- `server.js`: Express server with Prisma
- `prisma/schema.prisma`: DB schema (Mail table exists)
- `docs/`: Architecture, data model, AI plan, roadmap, API spec, n8n integration

## Quick start
- Ensure Postgres and DATABASE_URL are set
- Install deps and generate Prisma client
- Start server

> See docs for full plan and next steps.
