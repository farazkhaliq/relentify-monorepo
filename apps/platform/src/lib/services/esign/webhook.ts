import { createHmac } from 'crypto'
import { appendAuditLog } from './audit'

interface WebhookPayload {
  event: string
  signingRequestId: string
  signerEmail: string
  signedAt: string
  signatureImageBase64: string
  metadata: Record<string, unknown> | null
}

// Retry delays in milliseconds: 30s, then 120s
const RETRY_DELAYS = [30_000, 120_000]

async function attemptWebhook(
  callbackUrl: string,
  signature: string,
  body: string,
  signingRequestId: string,
  attempt: number
): Promise<boolean> {
  try {
    const res = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': signature,
      },
      body,
    })

    await appendAuditLog({
      signingRequestId,
      action: res.ok ? 'webhook_sent' : 'webhook_failed',
      details: { status: res.status, url: callbackUrl, attempt },
    })

    return res.ok
  } catch (err) {
    await appendAuditLog({
      signingRequestId,
      action: 'webhook_failed',
      details: {
        error: err instanceof Error ? err.message : 'Unknown error',
        url: callbackUrl,
        attempt,
      },
    })
    return false
  }
}

export async function dispatchWebhook(
  callbackUrl: string,
  callbackSecret: string,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', callbackSecret).update(body).digest('hex')

  // Attempt 1: immediate (fire and forget the retry chain)
  const firstOk = await attemptWebhook(callbackUrl, signature, body, payload.signingRequestId, 1)

  if (!firstOk) {
    // Schedule retries in-process (acceptable for v1)
    let retryIndex = 0

    const scheduleRetry = () => {
      if (retryIndex >= RETRY_DELAYS.length) return

      const delay = RETRY_DELAYS[retryIndex]
      retryIndex++

      setTimeout(async () => {
        const ok = await attemptWebhook(
          callbackUrl,
          signature,
          body,
          payload.signingRequestId,
          retryIndex + 1
        )
        if (!ok) scheduleRetry()
      }, delay)
    }

    scheduleRetry()
  }
}
