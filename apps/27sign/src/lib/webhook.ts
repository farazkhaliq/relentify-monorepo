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

export async function dispatchWebhook(
  callbackUrl: string,
  callbackSecret: string,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', callbackSecret).update(body).digest('hex')

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
      signingRequestId: payload.signingRequestId,
      action: res.ok ? 'webhook_sent' : 'webhook_failed',
      details: { status: res.status, url: callbackUrl },
    })
  } catch (err) {
    await appendAuditLog({
      signingRequestId: payload.signingRequestId,
      action: 'webhook_failed',
      details: { error: err instanceof Error ? err.message : 'Unknown error', url: callbackUrl },
    })
  }
}
