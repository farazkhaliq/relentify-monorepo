# Relentify E-Sign (27sign) — Claude Notes

## What this app does
Full document signing service for the Relentify suite. Users upload PDFs or Word docs, place signature/initials/date/text fields on specific pages via drag-and-drop, add one or more signers, and send. Signers verify their email via OTP, see the document rendered as a webpage with interactive field overlays, fill all fields, and submit. The signed PDF is generated with all signatures composited at the correct positions and emailed to all parties.

Also supports text-only confirmation signing (no document upload) for simple acknowledgements like property inventory confirmations.

**URL:** https://esign.relentify.com
**Container:** `27sign` on port 3027
**Network:** `infra_default`
**Source:** `/opt/relentify-monorepo/apps/27sign/`
**Database:** `esign` on `infra-postgres` (separate from shared `relentify` DB)

---

## Tech stack
- Next.js 15 App Router (TypeScript)
- Raw `pg` Pool for database queries (no Prisma — snake_case tables)
- PostgreSQL: `infra-postgres`, db: `esign`, user: `relentify_user`
- Auth: shared JWT cookie (`relentify_token`) for agent dashboard; API keys for service-to-service; signer session JWT (1hr) after OTP for public signing
- `pdfjs-dist` (Apache 2.0) — client-side PDF page rendering
- `pdf-lib` (MIT) — server-side PDF compositing (embed signatures onto PDF)
- `signature_pad` (MIT) — canvas signature drawing
- `libreoffice-writer` + `libreoffice-common` — Word→PDF conversion in Docker
- `@relentify/ui` for all UI components
- Resend for emails (OTP, signing invites, reminders, completion)
- Stripe for subscription billing

---

## Database schema (8 tables)

### api_keys
API key authentication for consuming apps + self-service users. Keys stored as SHA-256 hashes. Has `user_id` for self-service keys, `request_count` for usage tracking.

### signing_requests
Each signing request. Has token (256-bit URL-safe), status (pending/signed/expired/cancelled), signer email, title, body text with SHA-256 hash, callback URL/secret, metadata JSONB. Extended with: `signing_mode` (single/parallel/sequential), `document_id` FK, `all_signed`, `signed_pdf_data`, `pre_sign_hash`, `post_sign_hash`, `reminder_interval_hours`.

### signatures
Reusable signatures keyed by email. Stores base64 PNG image data and source (draw/upload). Shared across all signing requests for the same email.

### audit_log
Hash-chained append-only log. Each entry includes SHA-256 hash of (previous_hash + action + timestamp). Actions: created, otp_sent, otp_verified, viewed, field_filled, signed, declined, tsa_timestamped, webhook_sent, webhook_failed, pdf_generated, invite_resent, reminder_sent.

### otp_codes
Email verification codes. 6-digit, 10-min expiry, max 3 attempts.

### user_subscriptions
Stripe billing per user. Tracks tier (free/personal/standard/business_pro), stripe_customer_id, subscription status, requests_this_month.

### documents (new — document signing)
Uploaded PDFs stored as base64. Has original_filename, original_format (pdf/docx), page_count, page_dimensions JSONB (array of {width, height, rotation} per page in PDF points).

### document_fields (new — document signing)
Placed fields on document pages. Each field has: field_type (signature/initials/date/text), signer_email, page_number, position as percentages (x_percent, y_percent, width_percent, height_percent), value (filled by signer), prefilled flag, aspect_ratio_locked.

### signing_request_signers (new — multi-signer)
Links signers to requests. Each signer has their own token, sign_order, status (pending/sent/signed/declined), decline_reason, snapshot_hash (for sequential lock verification).

---

## API Routes

### Internal API (API key auth: `Authorization: Bearer rs_live_...`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/requests` | POST | Create signing request (accepts multipart with file + fields + signers) |
| `/api/v1/requests/[id]` | GET | Check status |
| `/api/v1/requests/[id]` | POST | Cancel request |
| `/api/v1/requests/[id]/signature` | GET | Get signature image |
| `/api/v1/requests/[id]/resend` | POST | Resend signing invite to a signer |
| `/api/v1/requests/[id]/remind` | POST | Send reminder to pending signers |

### Document API (JWT auth)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/upload` | POST | Upload PDF/Word, convert if needed, return doc ID + page count |
| `/api/documents/[id]/pdf` | GET | Serve raw PDF base64 for client-side rendering |
| `/api/documents/[id]/fields` | POST/GET | Save/retrieve field placements (batch) |
| `/api/documents/[id]/detect-fields` | POST | Auto-detect signature/date placeholders in PDF text |
| `/api/documents/[id]/signed-pdf` | GET | Download final signed PDF |

### Public signing API (session auth after OTP)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sign/[token]` | GET | Fetch request details + trigger OTP |
| `/api/sign/[token]/verify-email` | POST | Submit OTP → returns session JWT |
| `/api/sign/[token]/saved-signatures` | GET | Get saved sigs (after OTP) |
| `/api/sign/[token]/document` | GET | Get PDF + signer's fields for rendering |
| `/api/sign/[token]/fill-field` | POST | Fill one field (individually audited) |
| `/api/sign/[token]/decline` | POST | Decline to sign (optional reason) |
| `/api/sign/[token]/complete` | POST | Finish signing → triggers PDF generation if all done |
| `/api/sign/[token]/resend-otp` | POST | Resend OTP email |

### Settings/Billing API (JWT auth)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings/subscription` | GET | Get user's subscription tier + usage |
| `/api/settings/keys` | GET/POST | List/create API keys |
| `/api/settings/keys/[id]` | DELETE | Deactivate API key |
| `/api/stripe/checkout` | POST | Create Stripe checkout session for upgrade |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |

---

## UI Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | JWT | Dashboard — signing requests list + usage stats + first-visit banner |
| `/requests/new` | JWT | Multi-step wizard: upload → place fields → add signers → send (also has text-only mode) |
| `/requests/[id]` | JWT | Request detail — document info, signers, audit trail, download signed PDF |
| `/settings` | JWT | API key management + Stripe billing |
| `/getting-started` | JWT | 4-step integration guide |
| `/docs` | JWT | API reference documentation |
| `/s/[token]` | No | Public signing page (OTP → document view + field overlays → sign) |
| `/certificate/[token]` | No | Certificate of Completion (print-ready) |

---

## Document signing flow

### Sender flow
1. Upload PDF or .docx (Word auto-converted via LibreOffice, 3 retries, 30s timeout)
2. PDF pages rendered client-side via pdfjs-dist
3. Drag-and-drop field placement: Signature, Initials, Date, Text (snap-to-grid, 0.5% increments)
4. Optional: "Detect Fields" button scans PDF text for keywords
5. Fields colour-coded per signer; pre-fill supported for text/date fields
6. Add signers, set parallel/sequential mode, send

### Signer flow
1. Open email link → OTP verification → session JWT issued (1hr)
2. Document pages rendered as scrollable webpage (lazy-loaded, max 3 at once)
3. Click highlighted field → modal opens (signature pad / date picker / text input)
4. Each field fill individually audited (IP, UA, timestamp)
5. Progress bar: "3 of 5 fields completed"
6. "Decline to Sign" option with reason
7. On complete: fields locked, snapshot hash stored

### Post-signing
1. Sequential: next signer gets email; previous signer's fields locked
2. When all done: pdf-lib composites signatures onto original PDF (Y-axis flip, DPI normalisation)
3. Pre/post document hashes stored
4. Signed PDF emailed as download link (+ inline attachment if <2MB)
5. Webhook dispatched with exponential backoff retry (3 attempts: immediate, +30s, +120s)

---

## Security & Compliance

- **UK Electronic Communications Act 2000** compliant
- **eIDAS SES/AES** compliant (email OTP = near-AES level)
- **US ESIGN Act / UETA** compliant
- **Hash-chained audit log** — tamper-evident, per-field action logging
- **RFC 3161 timestamps** via FreeTSA.org
- **Signer session JWT** — 1hr expiry after OTP; URL token alone insufficient
- **Sequential signing locks** — filled fields immutable after signer completes, snapshot hash per step
- **Document integrity** — SHA-256 hash before and after signing
- **HMAC-SHA256 webhooks** with exponential backoff retry
- **256-bit crypto tokens** — URL-safe, one-time use, 30-day expiry
- **10MB file upload limit**, PDF/DOCX only (MIME + extension check)

---

## Known issues / TODO

- **No MCP tests for document flow** — the 25 tests only cover text-only signing. Document upload, field placement, multi-signer, PDF generation, and sequential locks are untested.
- **Stripe products not created** — checkout/webhook routes exist but no actual Stripe products/prices for E-Sign tiers. Env vars `STRIPE_PRICE_PERSONAL` etc. are empty.
- **No reminder cron job** — the remind API endpoint exists but nothing calls it automatically after 48h.
- **Decline email not wired** — decline route updates DB but doesn't email the sender notification.
- **Column name bug** — request detail page queries `filename` but column is `original_filename`.
- **Browser testing needed** — pdfjs-dist rendering, FieldPlacer drag-and-drop, coordinate accuracy not yet verified visually.

---

## Integration: 23inventory

23inventory calls `POST /api/v1/requests` when an agent sends a confirmation email. The signing URL goes in the email. After the tenant signs, 27sign POSTs a webhook to `23inventory/api/webhooks/signing` with the signature data. 23inventory updates the inventory as confirmed with signature snapshot. PDF report embeds tenant signature.

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
docker builder prune -f
```

---

## Key files

### Library modules
| File | Purpose |
|------|---------|
| `src/lib/db.ts` | pg Pool connection to esign DB |
| `src/lib/auth.ts` | JWT cookie auth for dashboard users |
| `src/lib/auth-api.ts` | API key verification (SHA-256 hash lookup) |
| `src/lib/signer-session.ts` | Signer session JWT (1hr, issued after OTP) |
| `src/lib/signers.ts` | Multi-signer CRUD + orchestration |
| `src/lib/audit.ts` | Hash-chained audit log helpers |
| `src/lib/otp.ts` | OTP generation + verification |
| `src/lib/webhook.ts` | HMAC-signed webhook dispatch with retry |
| `src/lib/tsa.ts` | RFC 3161 Time Stamping Authority client |
| `src/lib/document.ts` | Document upload, Word→PDF conversion, dimension extraction |
| `src/lib/pdf-composer.ts` | Composite signatures onto PDF via pdf-lib |
| `src/lib/document-hash.ts` | SHA-256 document integrity hashing |
| `src/lib/tiers.ts` | Subscription tier limits + feature gating |
| `src/lib/subscription.ts` | Stripe subscription management |
| `src/lib/stripe.ts` | Stripe client + checkout session creation |
| `src/lib/email.ts` | Resend email wrapper |
| `src/lib/email-templates.ts` | HTML email builders (invite, complete, decline, remind) |

### UI components
| File | Purpose |
|------|---------|
| `src/components/PageRenderer.tsx` | pdfjs-dist single page canvas (lazy, IntersectionObserver) |
| `src/components/DocumentViewer.tsx` | Scrollable multi-page PDF viewer |
| `src/components/FieldPlacer.tsx` | Drag-and-drop field placement overlay (sender) |
| `src/components/DocumentSigner.tsx` | Signer document view with field overlays |
| `src/components/FieldModal.tsx` | Modal for filling a field (sig pad / date / text) |
| `src/components/SignatureCapture.tsx` | Tabbed draw/upload/saved signature component |
| `src/components/DrawPad.tsx` | signature_pad canvas wrapper |
| `src/components/UploadSignature.tsx` | File/camera upload for signature |
| `src/components/SavedSignatures.tsx` | Gallery of reusable saved signatures |

### Key pages
| File | Purpose |
|------|---------|
| `app/(main)/requests/new/page.tsx` | Multi-step wizard (upload → place fields → signers → send) |
| `app/(public)/s/[token]/SigningClient.tsx` | Main signing page (branches document vs text-only) |
| `app/certificate/[token]/page.tsx` | Certificate of Completion |
