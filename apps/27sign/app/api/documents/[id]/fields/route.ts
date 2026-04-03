import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { verifyApiKey } from '@/lib/auth-api'
import { query } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getAuthUser()
  const apiKey = !user ? await verifyApiKey(req.headers.get('authorization')) : null
  if (!user && !apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fields } = body

  if (!Array.isArray(fields)) {
    return NextResponse.json({ error: 'fields must be an array' }, { status: 400 })
  }

  // Delete existing fields for this document (full replacement)
  await query('DELETE FROM document_fields WHERE document_id = $1', [id])

  // Insert all new fields
  for (const field of fields) {
    const {
      signerEmail,
      fieldType,
      label,
      pageNumber,
      xPercent,
      yPercent,
      widthPercent,
      heightPercent,
      prefilled,
      value,
    } = field

    await query(
      `INSERT INTO document_fields
         (document_id, signer_email, field_type, label, page_number, x_percent, y_percent,
          width_percent, height_percent, prefilled, value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        signerEmail,
        fieldType,
        label ?? null,
        pageNumber,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
        prefilled ?? false,
        value ?? null,
      ]
    )
  }

  return NextResponse.json({ count: fields.length })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await query(
    `SELECT * FROM document_fields
     WHERE document_id = $1
     ORDER BY page_number ASC, y_percent ASC`,
    [id]
  )

  return NextResponse.json({ fields: rows })
}
