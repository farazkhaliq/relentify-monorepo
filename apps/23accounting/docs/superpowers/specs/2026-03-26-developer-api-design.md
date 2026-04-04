# Developer API — Public REST API + Webhooks

**Date:** 2026-03-26
**Scope:** 22accounting — API key auth layer on existing endpoints + webhook system
**Priority:** 6 (last)

---

## Objective

Open the existing 22accounting API to external developers and enterprise clients. Third parties can build integrations, pull data into their own systems, and receive real-time event notifications via webhooks. The API uses the same endpoints that power the 22accounting frontend — no duplication of business logic.

---

## Architecture

### Approach: Auth Layer on Existing Routes

The 50+ existing API endpoints already contain all the business logic. The developer API adds an authentication layer (API key → entity resolution → JWT-equivalent access) that sits in front of those routes via Next.js middleware.

No separate service or subdomain. API calls go to `accounts.relentify.com/api/v1/...` (or the equivalent app domain). Versioning is handled by a `/v1/` prefix rewrite in middleware.

### Request Flow

```
External caller
  → POST /api/v1/invoices
  → Middleware: reads Authorization: Bearer <api-key>
  → Looks up api_key in DB → resolves entity_id + user_id + scopes
  → Constructs auth context (same shape as JWT session)
  → Route handler runs as normal
  → Response returned
```

---

## API Key Management

### Database Schema

```sql
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  name          VARCHAR(100) NOT NULL,              -- e.g. "Zapier Integration"
  key_hash      VARCHAR(64) NOT NULL UNIQUE,        -- SHA-256 of the key
  key_prefix    VARCHAR(8) NOT NULL,                -- first 8 chars shown in UI: "rly_abc1"
  scopes        TEXT[] NOT NULL DEFAULT '{}',       -- e.g. ['invoices:read', 'customers:write']
  is_test_mode  BOOLEAN DEFAULT FALSE,              -- test keys do not write to DB
  allowed_ips   TEXT[],                             -- NULL = unrestricted; set = IP allowlist
  last_used_at  TIMESTAMPTZ,
  rotated_at    TIMESTAMPTZ,                        -- set when key is rotated; old key invalid after 1h grace
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,                        -- NULL = never expires
  revoked_at    TIMESTAMPTZ
);
```

### Key Format

`rly_` prefix + 32 random bytes as hex = `rly_a1b2c3d4e5f6...` (68 chars total). Only shown once on creation. Stored as SHA-256 hash.

### Key Rotation

Users can rotate an existing key ("Rotate" button in API Keys settings). This:
1. Generates a new key and shows it once (same as creation)
2. Records `rotated_at` on the old key row
3. Old key remains valid for a **1-hour grace period** to allow integration code to be updated without a hard cutover
4. After 1 hour, old key is automatically invalidated (middleware checks `rotated_at` + 1h)

### IP Allowlist

Optional per key. If `allowed_ips` is non-null, requests from unlisted IPs are rejected with `403 Forbidden`. Primarily for enterprise clients locking keys to their server IPs.

### UI: API Key Settings Page

New tab in `/dashboard/settings`: **"API Keys"**

- List existing keys: name, prefix, scopes, test mode badge, last used, created date
- "Create API Key" button → modal: name + scope selection + test mode checkbox + optional expiry + optional IP allowlist
- Key displayed once after creation with copy button and "I've copied this key" confirmation
- Sandbox/test mode is clearly labelled in the key list and on the create modal — not buried
- Revoke button per key (sets `revoked_at`, immediate effect)
- Rotate button per key (1-hour grace period)
- Scope warning: if a user selects all scopes, show a banner: "Broad access increases risk. Only select scopes your integration needs."
- Last 10 deliveries per webhook endpoint shown inline — no need to navigate elsewhere for quick debugging
- Curl/JavaScript/Python snippets collapsible next to each endpoint

### Scopes

| Scope | Access |
|-------|--------|
| `invoices:read` | GET invoices, quotes |
| `invoices:write` | POST/PUT/DELETE invoices, quotes |
| `customers:read` | GET customers |
| `customers:write` | POST/PUT/DELETE customers |
| `suppliers:read` | GET suppliers |
| `suppliers:write` | POST/PUT/DELETE suppliers |
| `bills:read` | GET bills |
| `bills:write` | POST/PUT/DELETE bills |
| `expenses:read` | GET expenses |
| `reports:read` | GET reports (P&L, balance sheet, etc.) |
| `webhooks:manage` | Create/delete webhook endpoints |

---

## Rate Limiting

In-memory sliding window rate limiter in middleware. No Redis dependency at launch.

| Tier | Limit |
|------|-------|
| `invoicing` | 30 req/min |
| `sole_trader` | 60 req/min |
| `small_business` | 120 req/min |
| `medium_business` | 300 req/min |
| `corporate` | 600 req/min |

On limit exceeded: `429 Too Many Requests` with `Retry-After` header.

Response headers on every API request:
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711450020
```

**Multi-instance note:** The in-memory limiter is per-process. At the current single-instance VPS deployment this is correct. If the deployment scales to multiple containers, the rate limiter must be migrated to a Postgres-backed sliding window (using a `rate_limit_counters` table with timestamp-bucketed rows) or Redis. The interface is the same — only the backing store changes. This is a future concern, documented here so it is not forgotten.

---

## Versioned Endpoints (`/api/v1/`)

Middleware rewrites `/api/v1/*` → `/api/*` internally. The `/v1/` prefix is the public-facing version. When breaking changes are needed, `/api/v2/` can be introduced alongside without touching existing routes.

### Public Endpoint List (v1)

| Method | Path | Scope |
|--------|------|-------|
| GET | `/api/v1/customers` | `customers:read` |
| POST | `/api/v1/customers` | `customers:write` |
| GET | `/api/v1/customers/:id` | `customers:read` |
| PUT | `/api/v1/customers/:id` | `customers:write` |
| DELETE | `/api/v1/customers/:id` | `customers:write` |
| GET | `/api/v1/suppliers` | `suppliers:read` |
| POST | `/api/v1/suppliers` | `suppliers:write` |
| GET | `/api/v1/invoices` | `invoices:read` |
| POST | `/api/v1/invoices` | `invoices:write` |
| GET | `/api/v1/invoices/:id` | `invoices:read` |
| POST | `/api/v1/invoices/:id/send` | `invoices:write` |
| POST | `/api/v1/invoices/:id/pay` | `invoices:write` |
| GET | `/api/v1/bills` | `bills:read` |
| POST | `/api/v1/bills` | `bills:write` |
| GET | `/api/v1/expenses` | `expenses:read` |
| GET | `/api/v1/reports/pl` | `reports:read` |
| GET | `/api/v1/reports/balance-sheet` | `reports:read` |
| GET | `/api/v1/reports/trial-balance` | `reports:read` |
| GET | `/api/v1/reports/aged-receivables` | `reports:read` |
| GET | `/api/v1/webhooks` | `webhooks:manage` |
| POST | `/api/v1/webhooks` | `webhooks:manage` |
| DELETE | `/api/v1/webhooks/:id` | `webhooks:manage` |

All list endpoints support: `?page=`, `?limit=` (max 100), `?from=` (ISO date), `?to=` (ISO date), `?status=`.

All responses follow a consistent envelope:
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 50, "total": 342, "hasMore": true }
}
```

### Error Envelope

All errors — including scope violations, rate limit, validation failures — return a consistent structure:

```json
{
  "error": {
    "code": "invoices_write_denied",
    "message": "API key missing invoices:write scope",
    "status": 403
  }
}
```

Structured error codes (snake_case, prefixed by resource) allow third-party apps to parse and handle errors programmatically rather than matching on message strings. HTTP status code in the body duplicates the response status for clients that strip headers.

---

## Webhooks

### Database Schema

```sql
CREATE TABLE webhook_endpoints (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  secret       VARCHAR(64) NOT NULL,      -- HMAC signing secret, shown once
  events       TEXT[] NOT NULL,           -- event types subscribed to
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id      UUID REFERENCES webhook_endpoints(id),
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  status_code      INTEGER,
  delivered_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  retry_count      INTEGER DEFAULT 0,
  next_retry_at    TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ            -- set after 5 failures; delivery stored for manual retry
);
```

### Event Types

| Event | Triggered when |
|-------|---------------|
| `invoice.created` | New invoice saved |
| `invoice.sent` | Invoice emailed to customer |
| `invoice.paid` | Payment recorded on invoice |
| `invoice.voided` | Invoice voided |
| `bill.created` | New bill saved |
| `bill.paid` | Payment recorded on bill |
| `customer.created` | New customer added |
| `supplier.created` | New supplier added |
| `expense.approved` | Expense approved |
| `payment.received` | Any payment received (invoice or bill) |

### Payload Format

```json
{
  "id": "evt_a1b2c3d4",
  "type": "invoice.paid",
  "created": "2026-03-26T14:32:00Z",
  "entity_id": "ent_xyz789",
  "data": {
    "invoice": { "id": "...", "number": "INV-0042", "amount": 1200.00, ... }
  }
}
```

### HMAC Signing

Every delivery includes header `Relentify-Signature: sha256=<hmac>`. Computed as HMAC-SHA256 of the raw request body using the endpoint's secret. Recipients verify this before processing.

Delivery headers also include:
```
Relentify-Delivery-Id: <webhook_deliveries.id>
Relentify-Retry-Count: 2
```

This gives the receiver visibility into retry context without parsing the body.

### Delivery & Retry

- First attempt: immediate (async, does not block the original request)
- Retry schedule on failure (non-2xx response or timeout): **exponential backoff with jitter**
  - Attempt 2: 5s ± 1s jitter
  - Attempt 3: 30s ± 5s jitter
  - Attempt 4: 5min ± 30s jitter
  - Attempt 5: 30min ± 2min jitter
  - Attempt 6: 2h ± 10min jitter (final attempt)
- Jitter prevents thundering herd when multiple endpoints fail simultaneously (e.g. a recipient's server goes down and recovers at the same time)
- After 5 failures: `dead_lettered_at` set on the delivery row; endpoint marked inactive; user notified by email
- **Dead-letter queue:** failed deliveries are not deleted — they remain in `webhook_deliveries` with `dead_lettered_at` set. The settings UI shows these with a "Retry manually" button that replays the payload to the endpoint

---

## Analytics & Monitoring

### API Usage Tracking

A `api_requests` table logs every authenticated API request:

```sql
CREATE TABLE api_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES api_keys(id),
  entity_id   UUID NOT NULL,
  endpoint    TEXT NOT NULL,       -- e.g. '/api/v1/invoices'
  method      TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Aggregated views used for:
- Per-key usage summary in API Keys settings (request count last 30 days, per endpoint breakdown)
- Capacity planning and billing decisions
- Detecting abuse: repeated `403`s from a key indicate a misconfigured integration; spikes in usage flag potential key compromise

### Webhook Delivery Metrics

- Delivery success rate per endpoint (surfaced in settings UI)
- Delivery lag (time from event to `delivered_at`) — monitored for SLA purposes
- Dead-lettered delivery count — triggers email to user when non-zero

---

## Sandbox / Test Mode

API keys can be created in "test mode" (checkbox at creation time, visible in key list). Test mode keys:
- Read operations return real data from the entity
- Write operations are validated (schema checks run) but **not committed to the database** — the response returns a realistic object with `"test": true` flag
- Webhooks are not triggered by test-mode writes
- Test mode is clearly badged in the settings UI and in every API response: `"test": true` at the top level of the envelope

---

## Documentation

Hosted at `help.relentify.com/api/` as a section of the help app (`apps/26help`). MDX-based, same structure as help articles.

Sections:
- Authentication (API keys, rotation, IP allowlist)
- Rate limiting
- Endpoints (with curl/JavaScript/Python examples per endpoint)
- Webhooks (setup, event reference, signature verification, dead-letter recovery)
- Sandbox / test mode

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `database/migrations/026_api_keys.sql` | New: `api_keys`, `webhook_endpoints`, `webhook_deliveries`, `api_requests` tables |
| `src/lib/api-key.service.ts` | New: generate, hash, lookup, validate, rotate API keys |
| `src/lib/webhook.service.ts` | New: register endpoints, dispatch events, exponential backoff + jitter retry, dead-letter |
| `src/lib/rate-limiter.ts` | New: in-memory sliding window rate limiter (Postgres-ready interface for future cluster use) |
| `middleware.ts` | Extend: API key auth path, rate limit headers, /v1/ rewrite, IP allowlist check |
| `app/api/v1/` | New: thin route handlers that resolve to existing services |
| `app/api/webhooks/route.ts` | New: CRUD for webhook endpoints |
| `app/dashboard/settings/page.tsx` | Add API Keys tab |
| `src/components/settings/ApiKeysPanel.tsx` | New: key list + create + revoke + rotate + sandbox badge + inline delivery log + code snippets |
| `apps/26help/content/api/` | New: developer documentation MDX files |
| `.env.example` | Add any new required env vars |
