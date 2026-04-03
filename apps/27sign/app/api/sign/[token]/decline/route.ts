import { NextRequest, NextResponse } from 'next/server'
import { verifySignerSession } from '@/lib/signer-session'
import { isOtpVerified } from '@/lib/otp'
import { getSignerByToken, markSignerDeclined } from '@/lib/signers'
import { appendAuditLog } from '@/lib/audit'
import { query } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { signerDeclinedEmail } from '@/lib/email-templates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Try session auth first, fall back to legacy OTP check
  const session = await verifySignerSession(req)

  let signerId: string
  let signingRequestId: string

  if (session) {
    signerId = session.signerId
    signingRequestId = session.signingRequestId
  } else {
    const signer = await getSignerByToken(token)
    if (signer) {
      const verified = await isOtpVerified(signer.signing_request_id)
      if (!verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })
      signerId = signer.id
      signingRequestId = signer.signing_request_id
    } else {
      // Fallback: request-level token
      const { rows: srRows } = await query(
        'SELECT id FROM signing_requests WHERE token = $1',
        [token]
      )
      if (srRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const verified = await isOtpVerified(srRows[0].id)
      if (!verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })
      signerId = 'request-level' // No individual signer row
      signingRequestId = srRows[0].id
    }
  }

  const body = await req.json().catch(() => ({}))
  const reason: string | null = body.reason ?? null

  if (signerId === 'request-level') {
    // No individual signer row — update the request directly
    await query("UPDATE signing_requests SET status = 'cancelled' WHERE id = $1", [signingRequestId])
  } else {
    await markSignerDeclined(signerId, reason)
  }

  await appendAuditLog({
    signingRequestId,
    action: 'declined',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
    details: reason ? { reason } : null,
  })

  // Notify the sender
  const { rows: srRows } = await query(
    'SELECT sender_email, title, signer_email FROM signing_requests WHERE id = $1',
    [signingRequestId]
  )
  if (srRows.length > 0 && srRows[0].sender_email) {
    const sr = srRows[0]
    sendEmail(sr.sender_email, signerDeclinedEmail({
      signerName: sr.signer_email,
      documentTitle: sr.title,
      reason: reason || undefined,
    }))
  }

  return NextResponse.json({ success: true })
}
