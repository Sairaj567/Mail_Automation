# Deploy with Docker Compose (Traefik + Postgres + Backend + n8n)

This is a production-leaning example using Traefik for TLS and routing.

## Prereqs

- Ubuntu VM with Docker + Docker Compose
- DNS records:
  - `api.<your-domain>` → server public IP
  - `<subdomain>.<your-domain>` for n8n → server public IP
- Open ports 80/443

## Files

- `docker-compose.example.yml` – copy to `docker-compose.yml` and set env vars
- `traefik-dynamic.yaml` – dynamic middleware/services config
- `.env` – define DOMAIN_NAME, SUBDOMAIN, SSL_EMAIL, N8N_WEBHOOK_SECRET, GENERIC_TIMEZONE

## Environment file (.env)

Example:

```env
DOMAIN_NAME=example.com
SUBDOMAIN=n8n
SSL_EMAIL=you@example.com
GENERIC_TIMEZONE=Asia/Kolkata
N8N_WEBHOOK_SECRET=supersecret
```

## Bring up stack

```bash
docker compose up -d --build
```

## Verify

- Backend health: `https://api.<your-domain>/health`
- n8n UI: `https://<subdomain>.<your-domain>/`
- Postgres runs internally

## Notes

- Backend waits for Postgres health before starting migrations.
- Traefik acquires TLS via ACME TLS-ALPN challenge.
- Rate limiting middlewares on backend and n8n are included.
- Set strong Postgres credentials in production.
