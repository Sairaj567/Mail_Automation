# API Spec (Skeleton)

Base URL: `/` (monolith for now)

## Mails

- GET `/mails` → list mails
- POST `/mails` → create mail (from n8n)
- PATCH `/mails/:id` → update status/category

## Opportunities

- GET `/opportunities`
- POST `/opportunities`
- GET `/opportunities/:id`
- PATCH `/opportunities/:id`

## Students

- POST `/students`
- GET `/students/:id`
- PATCH `/students/:id`

## Applications

- POST `/opportunities/:id/apply`
- GET `/opportunities/:id/applications`
- PATCH `/applications/:id` → update status

Auth: JWT (roles: admin, student). Rate limits on n8n webhook. Validation via zod/yup.
