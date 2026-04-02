# Relentify E-Sign (27sign) — Claude Notes

## What this app does
Standalone digital signature service for the Relentify suite. Any Relentify app can create signing requests via API. Signers verify their email via OTP, then draw/upload/reuse a saved signature. Signatures are stored with hash-chained audit trails, RFC 3161 timestamps, and HMAC-signed webhook callbacks.

**URL:** https://esign.relentify.com
**Container:** `27sign` on port 3027
**Network:** `infra_default`
**Source:** `/opt/relentify-monorepo/apps/27sign/`
**Database:** `signing` on `infra-postgres` (separate from shared `relentify` DB)

---

## Tech stack
- Next.js 15 App Router (TypeScript)
- Raw `pg` Pool for database queries (no Prisma — snake_case tables)
- PostgreSQL: `infra-postgres`, db: `signing`, user: `relentify_user`
- Auth: shared JWT cookie (`relentify_token`) via `@relentify/auth` for agent dashboard; API keys for service-to-service; token-based for public signing page
- `signature_pad` (MIT, ~30KB) for canvas drawing
- `@relentify/ui` for all UI components
- Resend for OTP emails

---

## Database schema (5 tables)

### api_keys
API key authentication for consuming apps. Keys stored as SHA-256 hashes.

### signing_requests
Each signing request from a consuming app. Has token (URL-safe), status (pending/signed/expired/cancelled), signer email, title, body text with SHA-256 hash, callback URL/secret, metadata JSONB.

### signatures
Reusable signatures keyed by email. Stores base64 PNG image data and source (draw/upload).

### audit_log
Hash-chained append-only log. Each entry includes SHA-256 hash of (previous_hash + action + timestamp). Actions: created, otp_sent, otp_verified, viewed, signed, tsa_timestamped, webhook_sent.

### otp_codes
Email verification codes. 6-digit, 10-min expiry, max 3 attempts.

---

## API Routes

### Internal API (API key auth: `Authorization: Bearer rs_live_...`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/requests` | POST | Create signing request |
| `/api/v1/requests/[id]` | GET | Check status |
| `/api/v1/requests/[id]` | POST | Cancel request |
| `/api/v1/requests/[id]/signature` | GET | Get signature image |

### Public API (token-gated, no auth)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sign/[token]` | GET | Fetch request details + send OTP |
| `/api/sign/[token]/verify-email` | POST | Submit OTP code |
| `/api/sign/[token]/saved-signatures` | GET | Get saved sigs (after OTP) |
| `/api/sign/[token]/complete` | POST | Submit signature |
| `/api/health` | GET | Health check |

---

## UI Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | Yes (JWT) | Agent dashboard — list signing requests |
| `/requests/[id]` | Yes (JWT) | Request detail — timeline, signature, audit |
| `/s/[token]` | No | Public signing page (OTP → draw/upload/saved → sign) |
| `/certificate/[token]` | No | Certificate of Completion (print-ready) |

---

## Security & Compliance

- **UK Electronic Communications Act 2000** compliant
- **eIDAS SES/AES** compliant (email OTP = near-AES level)
- **US ESIGN Act / UETA** compliant
- **Hash-chained audit log** — tamper-evident, cryptographically verifiable
- **RFC 3161 timestamps** via FreeTSA.org
- **HMAC-SHA256 webhooks** — consuming apps verify `X-Signature-256` header
- **Document integrity** — SHA-256 hash of body text verified at signing time
- **256-bit crypto tokens** — URL-safe, one-time use, 30-day expiry
- **Rate limiting**: Public endpoints limited to prevent brute-force

---

## Integration: 23inventory

23inventory calls `POST /api/v1/requests` when an agent sends a confirmation email. The signing URL goes in the email. After the tenant signs, 27sign POSTs a webhook to `23inventory/api/webhooks/signing` with the signature data. 23inventory updates the inventory as confirmed with signature snapshot.

**23inventory .env vars:**
- `SIGNING_API_KEY` — API key for 27sign
- `SIGNING_WEBHOOK_SECRET` — HMAC secret for webhook verification
- `SIGNING_SERVICE_URL` — `http://27sign:3000` (internal Docker network)

**Fallback:** If 27sign is unavailable, 23inventory falls back to the legacy `/confirm/[token]` flow.

---

## Deployment
```bash
cd /opt/relentify-monorepo
docker compose -f apps/27sign/docker-compose.yml down
docker compose -f apps/27sign/docker-compose.yml build --no-cache
docker compose -f apps/27sign/docker-compose.yml up -d
docker logs 27sign --tail 50
```

---

## Key files
- `src/lib/db.ts` — pg Pool connection to signing DB
- `src/lib/auth-api.ts` — API key verification (SHA-256 hash lookup)
- `src/lib/audit.ts` — Hash-chained audit log helpers
- `src/lib/otp.ts` — OTP generation + verification
- `src/lib/webhook.ts` — HMAC-signed webhook dispatch
- `src/lib/tsa.ts` — RFC 3161 Time Stamping Authority client
- `src/components/SignatureCapture.tsx` — Tabbed draw/upload/saved component
- `src/components/DrawPad.tsx` — signature_pad canvas wrapper
- `app/(public)/s/[token]/SigningClient.tsx` — Main signing page client component
- `app/certificate/[token]/page.tsx` — Certificate of Completion
