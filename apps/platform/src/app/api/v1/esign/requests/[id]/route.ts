import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/services/esign/auth-api'
import { query } from '@/lib/services/esign/db'
import { appendAuditLog } from '@/lib/services/esign/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { rows } = await query(
    'SELECT id, token, app_id, signer_email, signer_name, title, status, expires_at, signed_at, created_at FROM esign_signing_requests WHERE id = $1 AND app_id = $2',
    [id, auth.appId]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(rows[0])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { rows } = await query(
    'SELECT id, status FROM esign_signing_requests WHERE id = $1 AND app_id = $2',
    [id, auth.appId]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rows[0].status !== 'pending') {
    return NextResponse.json({ error: 'Cannot cancel — status is ' + rows[0].status }, { status: 409 })
  }

  await query("UPDATE esign_signing_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [id])

  await appendAuditLog({
    signingRequestId: id,
    action: 'cancelled',
    details: { appId: auth.appId },
  })

  return NextResponse.json({ success: true })
}
