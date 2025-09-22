# n8n Integration

Your current n8n flow can keep classifying Gmail and POST to this backend.

## Suggested Webhook Contract

Endpoint: `POST /mails`

Header: `x-webhook-secret: N8N_WEBHOOK_SECRET`

Body (JSON):

```json
{
  "from": "hr@company.com",
  "to": "tpo@college.edu",
  "subject": "Campus Drive - Software Engineer",
  "body": "Full email body (text/plain or extracted)",
  "category": "campus_drive",
  "receivedAt": "2025-09-21T10:00:00.000Z"
}
```

Optional: include attachments uploaded to cloud; store URLs via a future `Attachment` model.

## Gmail → n8n Steps (example)

- Trigger: Gmail new email (IMAP or Gmail node)
- Extract plain text body (or use HTML to text)
- LLM classification node → category + key fields
- HTTP Request → POST to backend `/mails` with secret header
- Mark Gmail message as read or labeled

## Security

- Set `N8N_WEBHOOK_SECRET` in both n8n HTTP header and backend env.
- Rate limit on backend (future) and retry on 429/5xx from n8n.
