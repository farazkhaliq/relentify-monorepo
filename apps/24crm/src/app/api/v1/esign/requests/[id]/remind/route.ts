import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/services/esign/auth-api'
import { query } from '@/lib/services/esign/db'
import { appendAuditLog } from '@/lib/services/esign/audit'
import { sendEmail } from '@/lib/services/esign/email'
import { reminderEmail } from '@/lib/services/esign/email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { rows } = await query(
    `SELECT id, token, app_id, signer_email, signer_name, title, status
     FROM esign_signing_requests WHERE id = $1 AND app_id = $2`,
    [id, auth.appId]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sr = rows[0]

  if (sr.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot remind — request status is ${sr.status}` },
      { status: 409 }
    )
  }

  const signingUrl = `${APP_URL}/s/${sr.token}`
  const template = reminderEmail({
    signerName: sr.signer_name || undefined,
    documentTitle: sr.title,
    signingUrl,
  })

  const sent = await sendEmail(sr.signer_email, template)

  await appendAuditLog({
    signingRequestId: sr.id,
    action: sent ? 'reminder_sent' : 'reminder_failed',
    details: { sentTo: sr.signer_email, appId: auth.appId },
  })

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send reminder email' }, { status: 500 })
  }

  return NextResponse.json({ success: true, sentTo: [sr.signer_email] })
}
