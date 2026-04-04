import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/esign/db'
import { appendAuditLog } from '@/lib/services/esign/audit'
import { createOtp } from '@/lib/services/esign/otp'
import { Resend } from 'resend'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { rows } = await query(
    `SELECT id, title, body_text, signer_name, signer_email, status, expires_at, app_id
     FROM esign_signing_requests WHERE token = $1`,
    [token]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sr = rows[0]
  if (sr.status === 'expired' || (sr.expires_at && new Date(sr.expires_at) < new Date())) {
    if (sr.status !== 'expired') {
      await query("UPDATE esign_signing_requests SET status = 'expired' WHERE id = $1", [sr.id])
    }
    return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
  }

  // Check if OTP already exists for this request
  const { rows: otpRows } = await query(
    'SELECT verified_at FROM esign_otp_codes WHERE signing_request_id = $1 ORDER BY created_at DESC LIMIT 1',
    [sr.id]
  )
  const otpVerified = otpRows.length > 0 && otpRows[0].verified_at !== null
  const otpSent = otpRows.length > 0

  // Send OTP on first view if not already sent
  if (!otpSent && sr.status === 'pending') {
    const code = await createOtp(sr.id, sr.signer_email)
    const maskedEmail = maskEmail(sr.signer_email)

    try {
      const resend = getResend()
      if (!resend) throw new Error('Resend not configured')
      await resend.emails.send({
        from: 'Relentify Sign <sign@relentify.com>',
        to: sr.signer_email,
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
    } catch {
      // OTP created in DB even if email fails — for testing
    }

    await appendAuditLog({
      signingRequestId: sr.id,
      action: 'otp_sent',
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      userAgent: req.headers.get('user-agent') || null,
    })
  }

  await appendAuditLog({
    signingRequestId: sr.id,
    action: 'viewed',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
  })

  return NextResponse.json({
    title: sr.title,
    bodyText: sr.body_text,
    signerName: sr.signer_name,
    status: sr.status,
    appId: sr.app_id,
    expiresAt: sr.expires_at,
    otpVerified,
    maskedEmail: maskEmail(sr.signer_email),
  })
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}${local[1]}***@${domain}`
}
