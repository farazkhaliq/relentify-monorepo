import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/services/esign/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await query(
    `SELECT signed_pdf_data
     FROM esign_signing_requests
     WHERE document_id = $1 AND all_signed = TRUE`,
    [id]
  )

  if (!rows.length || !rows[0].signed_pdf_data) {
    return NextResponse.json({ error: 'Signed PDF not available' }, { status: 404 })
  }

  return NextResponse.json({ pdf: rows[0].signed_pdf_data })
}
