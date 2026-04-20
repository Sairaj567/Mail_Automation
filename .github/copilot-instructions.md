# Copilot Instructions for Mail_Automation

These reminders keep agents productive in this repository. The active stack is Express + EJS + Mongoose.

## Agent operating mode
- Prefer small, targeted edits over broad rewrites.
- Validate assumptions in code before introducing new fields, enums, or relationships.
- Preserve existing route/controller patterns, response formats, and role guards.
- When uncertain, follow behavior already implemented in sibling routes/controllers.

## Current architecture (verified)
- Entrypoint is `server/server.js`. Treat `server/app.js` as legacy scaffolding.
- Static mounts in `server/server.js` are:
  - `public/` at `/`
  - `client/js` at `/js`
  - `public/uploads` at `/uploads`
- Do not assume a `/css` mount from `client/css`; CSS is served via `public/`.
- `express-ejs-layouts` is imported, but `app.set('layout', false)` is active, so views currently render as full-page templates.
- `res.locals.user` and `res.locals.currentPath` are set globally.

## Security and middleware status (verified)
- `helmet`, `morgan`, body parsers, cookie parser, and recursive XSS sanitization are active in `server/server.js`.
- Auth rate limiting is active in `server/routers/authRoutes.js` (5 requests per 15 minutes for POST auth endpoints).
- `csurf` is installed/imported but not globally enforced in routing. Verify actual middleware wiring before adding CSRF-dependent assumptions.

## Routing and controller conventions
- Route files are under `server/routers/` and include role/session guards.
- Controllers in `server/controllers/` handle both EJS renders and JSON responses.
- Global error and 404 handlers in `server/server.js` return JSON for `/api/**`, XHR, or `Accept: application/json`; otherwise they render EJS error pages.
- Keep heavy business logic in controllers when possible, but note that some company routes still use inline route handlers.

## Data model conventions
- Mongoose models live in `server/models/`.
- Use `Job.postedBy` for ownership joins.
- Preserve existing enums and field names in `Job`, `Application`, `StudentProfile`, `CompanyProfile`, and `User`.
- `User` password hashing is model-driven (`pre('save')`); use `user.comparePassword()` for auth checks.

## File uploads (latest behavior)
- Student apply route (`/student/apply-job`) in `server/routers/studentRoutes.js` uses memory upload + magic-byte validation via `file-type`.
- Student upload middleware writes files using an atomic temp-file then rename flow to reduce race-condition risk.
- Current apply-job middleware writes uploaded files to `public/uploads/resumes`.
- Company logo uploads use disk storage in `server/routers/companyRoutes.js` at `public/uploads/company-logos` and accept `image/*` up to 5MB.
- Preserve filename-only persistence in MongoDB; served files should remain under `public/uploads/**`.

## Logging (latest behavior)
- Structured logger lives in `server/config/logger.js` (Winston, file + console transports).
- Student upload and application flows use this logger.
- Other modules still use `console.*` in places; align to logger incrementally rather than rewriting everything at once.

## Integrations and automation
- n8n routes are mounted at `/api/n8n` in `server/routers/n8nRoutes.js`.
- Company profile/job ingestion handlers are in `companyController`.
- Student application sync in `studentController.applyForJob` can call:
  - `N8N_RESUME_DRIVE_WEBHOOK_URL`
  - `N8N_JOB_APPLICATION_WEBHOOK_URL`
- Resume URL payloads can be built from `APP_BASE_URL` when set.

## Sessions, roles, and demo mode
- Session storage uses `express-session` + `connect-mongo`.
- Typical session shape: `{ id, email, name, role, isDemo? }`.
- Preserve demo-mode restrictions for write actions.
- Role failures should redirect to `/auth/login?role=<role>`.

## Local workflows
- Required env var: `SESSION_SECRET` (server exits if missing).
- Optional env vars: `MONGODB_URI`, `PORT`, `N8N_WEBHOOK_SECRET`, `N8N_JOB_APPLICATION_WEBHOOK_URL`, `N8N_MAIL_SHEET_MAKER_WEBHOOK_URL`, `N8N_RESUME_DRIVE_WEBHOOK_URL`, `APP_BASE_URL`, `LOG_LEVEL`.
- Common commands:
  - `npm install`
  - `npm run dev`
  - `npm start`
  - `npm run seed`
  - `npm test`

## Fast file map
- Auth/session: `server/controllers/authController.js`, `server/routers/authRoutes.js`, `server/middleware/auth.js`
- Student: `server/controllers/studentController.js`, `server/routers/studentRoutes.js`, `views/pages/student/**`
- Company: `server/controllers/companyController.js`, `server/routers/companyRoutes.js`, `views/pages/company/**`
- Admin: `server/controllers/adminController.js`, `server/routers/adminRoutes.js`, `views/pages/admin/**`
- Shared layout/partials: `views/layouts/**`, `views/partials/**`

## Implementation checklist
1. Add/adjust route in `server/routers/*Routes.js` with correct auth/role middleware.
2. Keep business logic in the matching controller unless existing route patterns require inline handling.
3. Reuse established JSON response style (`{ success, message, ... }`) used in that feature area.
4. Respect demo-mode restrictions for write actions.
5. Keep uploads inside `public/uploads/...` and persist only filenames.
6. Render from `views/pages/...` and rely on `res.locals.user` for session context.

## Do / Don’t
- Do verify runtime behavior directly in current code before changing middleware assumptions.
- Do preserve role checks and response formats in each router/controller area.
- Don’t reintroduce stale assumptions about placeholder config modules under `server/config`.
- Don’t edit legacy `server/app.js` unless explicitly requested.
