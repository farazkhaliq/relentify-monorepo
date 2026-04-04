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
    `INSERT INTO acc_webhook_endpoints (entity_id, url, secret, events)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.entityId, params.url, secret, params.events]
  );
  return { secret, endpoint: r.rows[0] };
}

export async function listWebhookEndpoints(entityId: string) {
  const r = await query(
    'SELECT id, entity_id, url, events, is_active, created_at FROM acc_webhook_endpoints WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  );
  return r.rows;
}

export async function deleteWebhookEndpoint(id: string, entityId: string): Promise<boolean> {
  const r = await query(
    'DELETE FROM acc_webhook_endpoints WHERE id = $1 AND entity_id = $2 RETURNING id',
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
    `SELECT * FROM acc_webhook_endpoints
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
      `INSERT INTO acc_webhook_deliveries (endpoint_id, event_type, payload, status, next_retry_at)
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
       FROM acc_webhook_deliveries d
       JOIN acc_webhook_endpoints e ON e.id = d.endpoint_id
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
  const dr = await query('SELECT retry_count FROM acc_webhook_deliveries WHERE id = $1', [deliveryId]);
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
      `UPDATE acc_webhook_deliveries
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
      `UPDATE acc_webhook_deliveries
       SET status = 'dead_lettered', status_code = $1, retry_count = $2,
           failed_at = NOW(), dead_lettered_at = NOW()
       WHERE id = $3`,
      [statusCode, newRetryCount, deliveryId]
    );
    // Deactivate the endpoint
    await query(
      `UPDATE acc_webhook_endpoints SET is_active = FALSE
       WHERE id = (SELECT endpoint_id FROM acc_webhook_deliveries WHERE id = $1)`,
      [deliveryId]
    );
    // Email notification would be sent here via email.ts (omitted for brevity — wire up in integration)
  } else {
    const retryAfterMs = nextRetryMs(newRetryCount - 1);
    const nextRetryAt = new Date(Date.now() + retryAfterMs).toISOString();
    await query(
      `UPDATE acc_webhook_deliveries
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
     FROM acc_webhook_deliveries d
     JOIN acc_webhook_endpoints e ON e.id = d.endpoint_id
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
    `SELECT d.id FROM acc_webhook_deliveries d
     JOIN acc_webhook_endpoints e ON e.id = d.endpoint_id
     WHERE d.id = $1 AND e.entity_id = $2 AND d.status = 'dead_lettered'`,
    [deliveryId, entityId]
  );
  if (r.rows.length === 0) return false;

  // Reset delivery to pending
  await query(
    `UPDATE acc_webhook_deliveries
     SET status = 'pending', retry_count = 0, dead_lettered_at = NULL, next_retry_at = NOW()
     WHERE id = $1`,
    [deliveryId]
  );
  // Re-activate the endpoint
  await query(
    `UPDATE acc_webhook_endpoints SET is_active = TRUE
     WHERE id = (SELECT endpoint_id FROM acc_webhook_deliveries WHERE id = $1)`,
    [deliveryId]
  );
  return true;
}
