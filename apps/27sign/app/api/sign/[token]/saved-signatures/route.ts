import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isOtpVerified } from '@/lib/otp'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { rows: srRows } = await query(
    'SELECT id, signer_email FROM signing_requests WHERE token = $1',
    [token]
  )
  if (srRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only return saved signatures after OTP verification
  const verified = await isOtpVerified(srRows[0].id)
  if (!verified) return NextResponse.json({ error: 'Email not verified' }, { status: 403 })

  const { rows: sigRows } = await query(
    `SELECT id, image_data, source, created_at
     FROM signatures
     WHERE email = $1 AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT 5`,
    [srRows[0].signer_email.toLowerCase().trim()]
  )

  return NextResponse.json({
    signatures: sigRows.map(s => ({
      id: s.id,
      imageData: s.image_data,
      source: s.source,
      createdAt: s.created_at,
    })),
  })
}
