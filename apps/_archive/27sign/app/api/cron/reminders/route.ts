import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { reminderEmail } from '@/lib/email-templates'
import { appendAuditLog } from '@/lib/audit'

const CRON_SECRET = process.env.CRON_SECRET || ''

export async function POST(req: NextRequest) {
  // Simple auth: check cron secret header
  const authHeader = req.headers.get('authorization') || ''
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

  // Find pending signing requests older than their reminder interval
  const { rows: pendingRequests } = await query(
    `SELECT sr.id, sr.token, sr.title, sr.signer_email, sr.reminder_interval_hours
     FROM signing_requests sr
     WHERE sr.status = 'pending'
       AND sr.reminder_interval_hours > 0
       AND sr.created_at < NOW() - (sr.reminder_interval_hours || ' hours')::interval
       AND NOT EXISTS (
         SELECT 1 FROM audit_log al
         WHERE al.signing_request_id = sr.id
           AND al.action = 'reminder_sent'
           AND al.created_at > NOW() - (sr.reminder_interval_hours || ' hours')::interval
       )
     LIMIT 50`
  )

  let sent = 0
  for (const sr of pendingRequests) {
    const signingUrl = `${appUrl}/s/${sr.token}`
    const template = reminderEmail({
      signerName: undefined,
      documentTitle: sr.title,
      signingUrl,
    })

    const ok = await sendEmail(sr.signer_email, template)

    await appendAuditLog({
      signingRequestId: sr.id,
      action: ok ? 'reminder_sent' : 'reminder_failed',
    })

    if (ok) sent++
  }

  return NextResponse.json({ sent, checked: pendingRequests.length })
}
