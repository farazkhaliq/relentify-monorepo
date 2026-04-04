import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth-api'
import { query } from '@/lib/db'
import { appendAuditLog } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { signingInviteEmail } from '@/lib/email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { rows } = await query(
    `SELECT id, token, app_id, signer_email, signer_name, title, status
     FROM signing_requests WHERE id = $1 AND app_id = $2`,
    [id, auth.appId]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sr = rows[0]

  if (sr.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot resend — request status is ${sr.status}` },
      { status: 409 }
    )
  }

  let body: { signerEmail?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const signerEmail = body.signerEmail?.trim().toLowerCase()
  if (!signerEmail) {
    return NextResponse.json({ error: 'signerEmail is required' }, { status: 400 })
  }

  if (signerEmail !== sr.signer_email.toLowerCase()) {
    return NextResponse.json({ error: 'signerEmail does not match this request' }, { status: 400 })
  }

  const signingUrl = `${APP_URL}/s/${sr.token}`
  const template = signingInviteEmail({
    signerName: sr.signer_name || undefined,
    documentTitle: sr.title,
    signingUrl,
  })

  const sent = await sendEmail(sr.signer_email, template)

  await appendAuditLog({
    signingRequestId: sr.id,
    action: sent ? 'invite_resent' : 'invite_resend_failed',
    details: { sentTo: sr.signer_email, appId: auth.appId },
  })

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
