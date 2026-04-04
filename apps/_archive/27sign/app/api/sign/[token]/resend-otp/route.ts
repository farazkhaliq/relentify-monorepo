import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { appendAuditLog } from '@/lib/audit'
import { createOtp } from '@/lib/otp'
import { sendEmail } from '@/lib/email'

// Minimum seconds between OTP resend requests
const RATE_LIMIT_SECONDS = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { rows } = await query(
    `SELECT id, signer_email, signer_name, title, status, expires_at
     FROM signing_requests WHERE token = $1`,
    [token]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sr = rows[0]

  if (sr.status !== 'pending') {
    return NextResponse.json({ error: 'Signing request is no longer pending' }, { status: 409 })
  }

  if (sr.expires_at && new Date(sr.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
  }

  // Rate limit: check if last OTP was sent within the last 60 seconds
  const { rows: otpRows } = await query(
    `SELECT created_at FROM otp_codes
     WHERE signing_request_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [sr.id]
  )

  if (otpRows.length > 0) {
    const lastSentAt = new Date(otpRows[0].created_at)
    const secondsSinceLast = (Date.now() - lastSentAt.getTime()) / 1000

    if (secondsSinceLast < RATE_LIMIT_SECONDS) {
      const retryAfter = Math.ceil(RATE_LIMIT_SECONDS - secondsSinceLast)
      return NextResponse.json(
        { error: `Please wait ${retryAfter} seconds before requesting a new code.` },
        { status: 429 }
      )
    }
  }

  const code = await createOtp(sr.id, sr.signer_email)

  await sendEmail(sr.signer_email, {
    subject: `Your verification code: ${code}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin: 0 0 8px; font-size: 20px;">Verification Code</h2>
        <p style="color: #666; margin: 0 0 24px;">Enter this code to verify your identity and sign the document.</p>
        <div style="background: #000; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin: 0 0 24px;">
          ${code}
        </div>
        <p style="color: #999; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })

  await appendAuditLog({
    signingRequestId: sr.id,
    action: 'otp_sent',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
    details: { resend: true },
  })

  return NextResponse.json({ success: true })
}
