import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { query } from '@/lib/services/inventory/db'

const WEBHOOK_SECRET = process.env.SIGNING_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-256')
  const body = await req.text()

  // Verify HMAC signature
  if (WEBHOOK_SECRET && signature) {
    const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const payload = JSON.parse(body)
  const { event, signingRequestId, signerEmail, signedAt, signatureImageBase64, metadata } = payload

  if (event !== 'signing.completed') {
    return NextResponse.json({ ok: true }) // Ignore unknown events
  }

  if (!metadata?.inventoryId) {
    return NextResponse.json({ error: 'Missing inventoryId in metadata' }, { status: 400 })
  }

  // Update the inventory with signature data
  await query(
    `UPDATE inv_items
     SET tenant_confirmed = TRUE,
         confirmed_at = $2,
         tenant_signature_data = $3,
         signing_request_id = $4
     WHERE id = $1`,
    [metadata.inventoryId, signedAt, signatureImageBase64, signingRequestId]
  )

  return NextResponse.json({ ok: true })
}
