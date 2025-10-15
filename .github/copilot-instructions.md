# Copilot Instructions for Mail_Automation

These notes teach AI coding agents how to work productively in this repo. Keep changes aligned with the current implementation (Express + EJS + Mongoose). Treat Prisma/Postgres files as future plans unless explicitly working on Docker deploy.

## Big picture
- Monolith web app: Express 5 + EJS views + sessions; MongoDB via Mongoose. Entrypoint: `server/server.js`.
- UI is server-rendered EJS under `views/` with a global layout `views/layouts/main.ejs`. Static assets in `public/` and `client/` (served via `/css`, `/js`, `/uploads`).
- Business domains (students, companies, jobs, applications) live under `server/models/*` (Mongoose) with route/controller pairs in `server/routers/*` and `server/controllers/*`.
- Docs + Prisma (`prisma/schema.prisma`, `docs/*`, Docker files) describe a Postgres/Prisma-based future “email ingestion + opportunities” service. That stack isn’t wired into the running app yet.

## Where to change what
- Web routes: update `server/routers/*Routes.js` and call controller functions. Example routes: `authRoutes`, `studentRoutes`, `companyRoutes`, `adminRoutes`.
- Controllers: return either EJS pages (`res.render`) or JSON APIs (`res.json({ success, message, ... })`) depending on the route. See `authController.js` patterns, including `redirectTo` in JSON.
- Models (Mongo): use existing Mongoose schemas: `User`, `StudentProfile`, `CompanyProfile`, `Job`, `Application`. Prefer `Job.postedBy` (ObjectId) to relate jobs to companies; avoid introducing new relation fields (some code mixes `company` vs `postedBy`—normalize on `postedBy`).
- Views: pages under `views/pages/{student|company|auth|admin}/`. Always pass `user: req.session.user` and page-specific props used by the templates.

## Conventions and patterns
- Session and roles: `req.session.user = { id, email, name, role }`. Gate access via helpers in routers (e.g., `requireStudent`, `requireCompany`).
- “Demo user” mode: many routes use `!mongoose.Types.ObjectId.isValid(req.session.user.id)` to return stub data and block writes. Preserve this behavior in new endpoints.
- Error responses: Global error/404 handlers choose JSON vs HTML by path prefix (e.g., `/company/`, `/student/`, `/auth/`). If you add routes under those prefixes, follow the same response shape.
- File uploads: use `multer` with disk storage. Student applies via `upload.fields([{ name: 'resume' }, { name: 'coverLetterFile' }])` saved to `public/uploads/{resumes|cover-letters}`. Companies upload logos at `public/uploads/company-logos`.
- Response shape: for APIs return `{ success: boolean, message: string, ... }` and optionally `redirectTo`.

## Run/debug (local)
- Env: `MONGODB_URI` (defaults to `mongodb://localhost:27017/placement_portal`), `SESSION_SECRET`, `PORT` (default 3000).
- Install and start:
  - `npm install`
  - `npm run dev` (nodemon) or `npm start` (plain node)
- Seed demo jobs (local Mongo): `npm run seed`.

## Deploy (Docker/Prisma path)
- The `docker-compose.example.yml` and `Dockerfile` target a Postgres/Prisma deployment (service named `backend` running `node server.js` with `prisma migrate deploy`). Use only when building the future email-ingestion service described in `docs/` and `prisma/schema.prisma`.
- If you edit Prisma schema, run `npx prisma generate` and migrations within that containerized workflow—do not inject Prisma calls into the current Express/Mongoose app.

## Integration points
- n8n → backend webhook (planned): see `docs/07-n8n-integration.md` and `docs/06-api-spec.md`. Implement under a dedicated router when needed (e.g., `POST /mails`), guarded by `x-webhook-secret`.

## Do/Don’t
- Do: keep new features in the Mongoose models and existing session/role patterns. Prefer `Job.postedBy` for company lookups.
- Don’t: mix Prisma into `server/` code, or change entrypoint (keep `server/server.js`). Don’t break demo-mode behavior.
