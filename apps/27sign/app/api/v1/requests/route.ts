import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { verifyApiKey } from '@/lib/auth-api'
import { query } from '@/lib/db'
import { generateToken } from '@/lib/tokens'
import { appendAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    signerEmail, signerName, title, bodyText,
    callbackUrl, callbackSecret, metadata,
    expiresInDays = 30, createdByUserId, createdByEntityId,
  } = body

  if (!signerEmail || !title || !bodyText) {
    return NextResponse.json({ error: 'signerEmail, title, and bodyText are required' }, { status: 400 })
  }

  const token = generateToken()
  const bodyTextHash = createHash('sha256').update(bodyText).digest('hex')
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

  const { rows } = await query(
    `INSERT INTO signing_requests
     (token, app_id, api_key_id, signer_email, signer_name, title, body_text, body_text_hash,
      metadata, callback_url, callback_secret, expires_at, created_by_user_id, created_by_entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, token`,
    [
      token, auth.appId, auth.keyId,
      signerEmail.toLowerCase().trim(), signerName || null,
      title, bodyText, bodyTextHash,
      metadata ? JSON.stringify(metadata) : null,
      callbackUrl || null, callbackSecret || null,
      expiresAt.toISOString(),
      createdByUserId || null, createdByEntityId || null,
    ]
  )

  const signingRequest = rows[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

  await appendAuditLog({
    signingRequestId: signingRequest.id,
    action: 'created',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    details: { appId: auth.appId },
  })

  return NextResponse.json({
    id: signingRequest.id,
    token: signingRequest.token,
    signingUrl: `${appUrl}/s/${signingRequest.token}`,
    status: 'pending',
    expiresAt: expiresAt.toISOString(),
  }, { status: 201 })
}
