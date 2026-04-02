import { NextRequest, NextResponse } from 'next/server'
import { verifySignerSession } from '@/lib/signer-session'
import { isOtpVerified } from '@/lib/otp'
import { getSignerByToken } from '@/lib/signers'
import { appendAuditLog } from '@/lib/audit'
import { query } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Try session auth first, fall back to legacy OTP check
  const session = await verifySignerSession(req)

  let signerEmail: string
  let signingRequestId: string

  if (session) {
    signerEmail = session.signerEmail
    signingRequestId = session.signingRequestId
  } else {
    // Legacy: look up signer by URL token, check OTP verified
    const signer = await getSignerByToken(token)
    if (!signer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const verified = await isOtpVerified(signer.signing_request_id)
    if (!verified) return NextResponse.json({ error: 'Not verified' }, { status: 403 })

    signerEmail = signer.email
    signingRequestId = signer.signing_request_id
  }

  const body = await req.json()
  const { fieldId, value } = body

  if (!fieldId || value === undefined || value === null) {
    return NextResponse.json({ error: 'fieldId and value are required' }, { status: 400 })
  }

  // Validate: field belongs to this signer's email
  const { rows: fieldRows } = await query(
    'SELECT id, signer_email, field_type, filled_at FROM document_fields WHERE id = $1',
    [fieldId]
  )
  if (fieldRows.length === 0) return NextResponse.json({ error: 'Field not found' }, { status: 404 })

  const field = fieldRows[0]
  if (field.signer_email !== signerEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate: field not already filled (prevent double-fill)
  if (field.filled_at !== null) {
    return NextResponse.json({ error: 'Field already filled' }, { status: 409 })
  }

  // Check signer hasn't already completed signing
  const { rows: signerRows } = await query(
    `SELECT srs.status, srs.sign_order, sr.signing_mode
     FROM signing_request_signers srs
     JOIN signing_requests sr ON sr.id = srs.signing_request_id
     WHERE srs.signing_request_id = $1
       AND srs.email = $2`,
    [signingRequestId, signerEmail]
  )

  if (signerRows.length > 0) {
    const signer = signerRows[0]

    // Prevent filling fields after signer has already signed
    if (signer.status === 'signed') {
      return NextResponse.json({ error: 'Already signed — cannot modify fields' }, { status: 403 })
    }

    // Sequential mode: check all previous signers have completed
    if (signer.signing_mode === 'sequential' && signer.sign_order > 0) {
      const { rows: prevRows } = await query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'signed') AS done
         FROM signing_request_signers
         WHERE signing_request_id = $1
           AND sign_order < $2`,
        [signingRequestId, signer.sign_order]
      )
      const total = parseInt(prevRows[0].total, 10)
      const done = parseInt(prevRows[0].done, 10)
      if (total > 0 && done < total) {
        return NextResponse.json({ error: 'Previous signers must complete first.' }, { status: 403 })
      }
    }
  }

  // Update field value
  await query(
    'UPDATE document_fields SET value = $1, filled_at = NOW() WHERE id = $2',
    [value, fieldId]
  )

  // Audit log
  await appendAuditLog({
    signingRequestId,
    action: 'field_filled',
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    userAgent: req.headers.get('user-agent') || null,
    details: { fieldId, fieldType: field.field_type },
  })

  return NextResponse.json({ success: true })
}
