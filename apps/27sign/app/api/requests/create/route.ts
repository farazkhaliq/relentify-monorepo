import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { generateToken } from '@/lib/tokens'
import { appendAuditLog } from '@/lib/audit'
import { getOrCreateSubscription, incrementRequestCount } from '@/lib/subscription'
import { getRequestLimit } from '@/lib/tiers'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check usage limits
  const sub = await getOrCreateSubscription(user.userId)
  const limit = getRequestLimit(sub.tier)
  if (sub.requestsThisMonth >= limit) {
    return NextResponse.json({
      error: `Monthly limit reached (${limit} requests). Upgrade your plan for more.`
    }, { status: 429 })
  }

  const { signerEmail, signerName, title, bodyText } = await req.json()

  if (!signerEmail || !title || !bodyText) {
    return NextResponse.json({ error: 'signerEmail, title, and bodyText are required' }, { status: 400 })
  }

  const token = generateToken()
  const bodyTextHash = createHash('sha256').update(bodyText).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const { rows } = await query(
    `INSERT INTO signing_requests
     (token, app_id, signer_email, signer_name, title, body_text, body_text_hash,
      expires_at, created_by_user_id, sender_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, token`,
    [
      token, 'esign-ui',
      signerEmail.toLowerCase().trim(), signerName || null,
      title, bodyText, bodyTextHash,
      expiresAt.toISOString(),
      user.userId,
      user.email,
    ]
  )

  const signingRequest = rows[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

  await incrementRequestCount(user.userId)

  await appendAuditLog({
    signingRequestId: signingRequest.id,
    action: 'created',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    details: { source: 'ui', userId: user.userId },
  })

  return NextResponse.json({
    id: signingRequest.id,
    token: signingRequest.token,
    signingUrl: `${appUrl}/s/${signingRequest.token}`,
    status: 'pending',
    expiresAt: expiresAt.toISOString(),
  }, { status: 201 })
}
