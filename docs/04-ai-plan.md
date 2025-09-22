# AI Components and Evaluation

## 1) Email Classification and IE

- Use n8n to invoke LLM for category classification and key-field extraction (role, location, salary, dates, apply link).
- Add rule-based post-processing and validation (dates in future, URLs valid, CTC numeric).
- Feedback loop: TPO can correct fields; store corrections to fine-tune prompts.

Metrics:

- Precision/recall on category; extraction accuracy per field; time-to-publish.

## 2) Resume Parsing

- Parse PDF to text + layout; extract entities: education (CGPA, 10th/12th), internships, projects, skills.
- Model options: open-source (spaCy, LayoutLM-based) with custom patterns; or LLM with structured output schema.
- Store parsed JSON next to resume; version outputs.

Metrics:

- Field-level F1; correctness on manually labeled set; latency.

## 3) Matching & Scoring

- Cosine similarity between opportunity skill vectors and resume skill vectors.
- Rule engine for hard filters (eligibility) + ML score for ranking.
- Explanations: top skills contributing to match; missing requirements.

Metrics:

- NDCG@k, selection rate@k, offer rate correlation.

## 4) Auto-Reply Generation

- Email templates with placeholders (company, role, count, top candidates, links to candidate pack).
- LLM can draft summary paragraphs; human-in-the-loop approval (optional).

## 5) Safety & Guardrails

- PII handling: redact before sending externally unless consented.
- Toxic/PII detection in inbound emails; file scanning on uploads.
- Rate limits, retry with backoff; circuit breakers for external APIs.
