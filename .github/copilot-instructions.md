# Copilot Instructions for Mail_Automation

These reminders keep AI agents productive in this repo. Focus on the running Express + EJS + Mongoose stack; Prisma + Postgres files under `docs/` and `prisma/` describe a future path only.

## Current architecture
- Entrypoint: `server/server.js` wires Express 5, Mongo-backed sessions, static mounts, and global EJS config. Ignore `server/app.js`; it’s legacy scaffolding.
- Static assets live in `public/` (served at `/`), `client/css|js` (served at `/css` and `/js`), and user uploads under `public/uploads/{resumes,cover-letters,company-logos}`.
- Layouts and pages: `views/layouts/main.ejs` wraps `views/pages/{auth|student|company|admin}/**`. Rendered views should receive the session user (already exposed via `res.locals.user`).

## Routing & controllers
- Route files end with `*Routes.js` in `server/routers/`; they own session/role guards (`requireStudent`, `requireCompany`) and `multer` setups.
- Controllers in `server/controllers/` render EJS or reply JSON. JSON handlers follow `{ success, message, redirectTo? }` (see `authController`).
- The global error handler in `server/server.js` switches to JSON for `/api/`, `/student/`, `/company/`, `/auth/` paths—keep new endpoints under those prefixes if you expect JSON.
- Prefer delegating heavy logic to controllers instead of anonymous route handlers; several routes still mix both, so align new work with the controller pattern.

## Data models & conventions
- Mongoose models live in `server/models/`. Key shapes:
  - `Job`: `company` stores the display name, `postedBy` references the owning `User`, `jobType` enum is `['internship','full-time','part-time','remote']`, `experienceLevel` is `['fresher','0-2','2-5','5+']`.
  - `Application`: embeds `personalInfo`, `education`, document filenames (`resume`, `coverLetterFile`), and status enum `['applied','under_review','shortlisted','interview','rejected','accepted']`.
  - `StudentProfile`: tracks `resume`, `skills`, `savedJobs` (Job ObjectIds), and `profileCompletion`.
  - `CompanyProfile`: stores company metadata plus optional `jobsPosted` list.
  - `User`: passwords hash in a `pre('save')`; call `user.comparePassword()` during auth.
- Normalize multiline/comma-delimited text fields into arrays (see `companyController.postJob`).
- Stick to `Job.postedBy` for joins; avoid adding alternative relationship fields.

## Sessions, roles, and demo mode
- Sessions use `express-session` + `connect-mongo`; `req.session.user` looks like `{ id, email, name, role, isDemo? }`.
- Demo users are detected via `req.session.user.isDemo` or `!mongoose.Types.ObjectId.isValid(id)`. Controllers often short-circuit to canned data or block writes for demos—preserve that behavior for new flows.
- Role checks live beside each router; failed access should redirect to `/auth/login?role=…`.

## File uploads & assets
- `studentRoutes.js` configures `multer` `upload.fields([{name:'resume'},{name:'coverLetterFile'}])` writing to `public/uploads/resumes` and `public/uploads/cover-letters` (PDF/DOC/DOCX only, 5 MB cap).
- `companyRoutes.js` sets up logo uploads to `public/uploads/company-logos`; reuse that storage pattern for new image fields.
- Persisted filenames are later served from `/uploads/...`; ensure new uploads land in `public/uploads` so EJS templates can link them.

## Integrations & automation
- n8n webhook endpoints live under `/api/n8n` (`server/routers/n8nRoutes.js`). `companyController.handleN8nCompanyUpdate` checks `x-webhook-secret` (or `x-n8n-secret`) against `process.env.N8N_WEBHOOK_SECRET`, then creates/updates a `User` + `CompanyProfile` and hashes a temp password.
- `server/config/{db,mailer,session}.js` are placeholders; real configuration is inline in `server/server.js`.

## Local workflows
- Required env vars: `MONGODB_URI` (defaults to `mongodb://localhost:27017/placement_portal`), `SESSION_SECRET`, optional `PORT`, optional `N8N_WEBHOOK_SECRET`.
- Setup: `npm install`, then `npm run dev` (nodemon) or `npm start` (plain node).
- Seed demo jobs (overwrites `Job` collection): `npm run seed`.
- No automated tests yet (`npm test` exits 1); rely on manual verification or ad-hoc scripts.

## Do / Don’t
- Do render pages from `views/pages/...` and rely on `res.locals.user` inside templates.
- Do mirror the existing JSON response contract and error handling prefixes when adding APIs.
- Don’t resurrect the Prisma/Postgres runtime or edit `server/app.js` unless explicitly working on the Docker/Prisma deployment track in `docs/`.
- Don’t bypass demo-mode guardrails or role checks—use the established helpers for new routes.
