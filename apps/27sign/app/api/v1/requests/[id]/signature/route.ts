import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth-api'
import { query } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { rows } = await query(
    `SELECT sr.status, s.image_data
     FROM signing_requests sr
     LEFT JOIN signatures s ON sr.signature_id = s.id
     WHERE sr.id = $1 AND sr.app_id = $2`,
    [id, auth.appId]
  )

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rows[0].status !== 'signed') return NextResponse.json({ error: 'Not yet signed' }, { status: 404 })
  if (!rows[0].image_data) return NextResponse.json({ error: 'No signature data' }, { status: 404 })

  return NextResponse.json({ signatureImageBase64: rows[0].image_data })
}
