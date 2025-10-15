# Next Steps: Integration and Enhancements

Here are focused, low-risk next steps to continue the project:

1. Candidate pack emailer
   - Add a small worker (Node script) that queries top N eligible students for an opportunity and renders a concise HTML pack.
   - Send mail to the company via an SMTP relay (Nodemailer) with tracking headers.
   - Endpoint: POST /opportunities/:id/share to enqueue a job.

2. Background jobs
   - Add Redis + BullMQ to the stack and a `worker.js` process.
   - Queues: `share-pack`, `resume-parse`, `classification`.
   - Compose: add redis:7-alpine, mount minimal persistence, healthcheck.

3. Resume uploads/storage
   - Add POST /students/:id/resumes to accept uploads (multipart/form-data).
   - Store on S3-compatible storage (MinIO for local/dev, AWS S3 for prod). Keep only presigned URLs in DB.
   - Scan for file type/size; reject > 10 MB.

4. Security + observability
   - Add request logging with pino-http (redact auth headers).
   - Add rate limiting (express-rate-limit) for public endpoints.
   - Add basic auth to n8n with environment vars and secure cookies behind Traefik.

5. Testing + API collection
   - Create a Postman/Bruno collection for the API.
   - Add minimal Jest tests for parsing and eligibility logic.

6. Data model hardening
   - Add audit logs to write paths.
   - Add indexes on frequent filters (mail.category, application.status).

7. Deployment hygiene
   - Create a `.env` with secure secrets and use Docker secrets for Postgres in production.
   - Configure Traefik access logs and error logs for incident analysis.
