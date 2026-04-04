import { createHmac } from 'crypto'
import pool from '../../pool'

export async function dispatchWebhook(entityId: string, event: string, payload: any): Promise<void> {
  const result = await pool.query(
    'SELECT * FROM chat_webhooks WHERE entity_id = $1 AND enabled = TRUE AND $2 = ANY(events)',
    [entityId, event]
  )

  for (const webhook of result.rows) {
    fireWebhook(webhook, event, payload).catch(err =>
      console.error(`Webhook ${webhook.id} failed:`, err.message)
    )
  }
}

async function fireWebhook(
  webhook: { id: string; url: string; secret: string | null },
  event: string,
  payload: any,
  attempt = 1
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
  }

  if (webhook.secret) {
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex')
    headers['X-Webhook-Signature'] = signature
  }

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    })

    // Update delivery status
    await pool.query(
      'UPDATE chat_webhooks SET last_delivery_at = NOW(), last_status = $1 WHERE id = $2',
      [response.status, webhook.id]
    ).catch(() => {})

    if (!response.ok && attempt < 3) {
      // Exponential backoff: 1s, 4s, 9s
      await new Promise(r => setTimeout(r, attempt * attempt * 1000))
      return fireWebhook(webhook, event, payload, attempt + 1)
    }
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * attempt * 1000))
      return fireWebhook(webhook, event, payload, attempt + 1)
    }
    // Log final failure
    await pool.query(
      'UPDATE chat_webhooks SET last_delivery_at = NOW(), last_status = 0 WHERE id = $1',
      [webhook.id]
    ).catch(() => {})
  }
}
