import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { query } from '@/lib/db'
import { isOtpVerified } from '@/lib/otp'
import { appendAuditLog } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhook'
import { requestTimestamp } from '@/lib/tsa'

const MAX_SIGNATURE_SIZE = 500 * 1024 // 500KB

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json()
  const { signatureData, source = 'draw', saveForFuture = false } = body

  if (!signatureData || typeof signatureData !== 'string') {
    return NextResponse.json({ error: 'signatureData is required' }, { status: 400 })
  }

  if (signatureData.length > MAX_SIGNATURE_SIZE) {
    return NextResponse.json({ error: 'Signature too large (max 500KB)' }, { status: 400 })
  }

  if (!signatureData.startsWith('data:image/png;base64,') && !signatureData.startsWith('data:image/jpeg;base64,')) {
    return NextResponse.json({ error: 'Invalid format — must be base64 PNG or JPEG' }, { status: 400 })
  }

  // Fetch signing request
  const { rows: srRows } = await query(
    'SELECT id, signer_email, status, body_text, body_text_hash, callback_url, callback_secret, metadata FROM signing_requests WHERE token = $1',
    [token]
  )
  if (srRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sr = srRows[0]
  if (sr.status === 'signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  if (sr.status !== 'pending') return NextResponse.json({ error: 'Cannot sign — status is ' + sr.status }, { status: 409 })

  // Verify OTP was completed
  const verified = await isOtpVerified(sr.id)
  if (!verified) return NextResponse.json({ error: 'Email verification required' }, { status: 403 })

  // Verify document integrity
  const currentHash = createHash('sha256').update(sr.body_text).digest('hex')
  if (currentHash !== sr.body_text_hash) {
    return NextResponse.json({ error: 'Document integrity check failed' }, { status: 409 })
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
  const userAgent = req.headers.get('user-agent') || null
  const email = sr.signer_email.toLowerCase().trim()

  // Save or reuse signature
  let signatureId: string

  if (saveForFuture) {
    // Upsert: deactivate old signatures for this email, insert new
    await query('UPDATE signatures SET is_active = FALSE WHERE email = $1', [email])
    const { rows: sigRows } = await query(
      'INSERT INTO signatures (email, image_data, source) VALUES ($1, $2, $3) RETURNING id',
      [email, signatureData, source]
    )
    signatureId = sigRows[0].id
  } else {
    // Store signature without email linkage (one-time)
    const { rows: sigRows } = await query(
      'INSERT INTO signatures (email, image_data, source, is_active) VALUES ($1, $2, $3, FALSE) RETURNING id',
      [email, signatureData, source]
    )
    signatureId = sigRows[0].id
  }

  // Update signing request
  await query(
    `UPDATE signing_requests
     SET status = 'signed', signed_at = NOW(), signer_ip = $2, signer_user_agent = $3, signature_id = $4, updated_at = NOW()
     WHERE id = $1`,
    [sr.id, ip, userAgent, signatureId]
  )

  // Audit log
  await appendAuditLog({
    signingRequestId: sr.id,
    action: 'signed',
    ip,
    userAgent,
    details: { source, savedForFuture: saveForFuture },
  })

  // Request RFC 3161 timestamp
  const tsaData = JSON.stringify({ signatureId, signedAt: new Date().toISOString(), bodyTextHash: sr.body_text_hash })
  const tsaToken = await requestTimestamp(tsaData)
  if (tsaToken) {
    await appendAuditLog({
      signingRequestId: sr.id,
      action: 'tsa_timestamped',
      details: { tsaResponse: tsaToken.substring(0, 200) + '...' }, // Truncate for storage
    })
  }

  // Dispatch webhook
  if (sr.callback_url && sr.callback_secret) {
    // Fire and forget — don't block the response
    dispatchWebhook(sr.callback_url, sr.callback_secret, {
      event: 'signing.completed',
      signingRequestId: sr.id,
      signerEmail: sr.signer_email,
      signedAt: new Date().toISOString(),
      signatureImageBase64: signatureData,
      metadata: sr.metadata,
    })
  }

  return NextResponse.json({ success: true })
}
