# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Security Features (v2.0)

Desygn AI includes built-in security protections:

- **PII Detection** — Automatic scanning for credit cards (Luhn), SSN, Vietnamese IDs, emails, phone numbers, auth tokens
- **Content Redaction** — Block or redact PII before AI processing or collaboration sync
- **Input Sanitization** — DOMPurify for all user-facing content, prompt injection prevention
- **Security Headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy via `vercel.json`
- **No Secrets in Code** — All API keys via environment variables only

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: security@desygn.ai (or open a private security advisory on GitHub)
3. Include: description, steps to reproduce, potential impact
4. We will acknowledge within 48 hours and provide a fix timeline

## Dependencies

We maintain all dependencies at their latest minor versions and run `npm audit` on every CI build. Current status: **0 known vulnerabilities**.
