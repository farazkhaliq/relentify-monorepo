import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/esign/db'
import { verifyOtp } from '@/lib/services/esign/otp'
import { appendAuditLog } from '@/lib/services/esign/audit'
import { getSignerByToken } from '@/lib/services/esign/signers'
import { createSignerSession } from '@/lib/services/esign/signer-session'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { code } = await req.json()

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const { rows } = await query(
    'SELECT id, status FROM esign_signing_requests WHERE token = $1',
    [token]
  )
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rows[0].status !== 'pending') {
    return NextResponse.json({ error: 'Already ' + rows[0].status }, { status: 409 })
  }

  const result = await verifyOtp(rows[0].id, code.trim())

  if (result.valid) {
    await appendAuditLog({
      signingRequestId: rows[0].id,
      action: 'otp_verified',
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      userAgent: req.headers.get('user-agent') || null,
    })

    const signer = await getSignerByToken(token)
    if (signer) {
      const sessionToken = await createSignerSession(signer.email, signer.signing_request_id, signer.id)
      return NextResponse.json({ verified: true, sessionToken })
    }

    return NextResponse.json({ verified: true })
  }

  return NextResponse.json({
    verified: result.valid,
    error: result.error || undefined,
  })
}
