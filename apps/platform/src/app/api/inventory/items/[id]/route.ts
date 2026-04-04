import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/inventory/db'
import { getAuthUser } from '@/lib/services/inventory/auth'
import { toInventory, toPhoto } from '@/lib/services/inventory/types'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows: invRows } = await query(
    'SELECT * FROM inv_items WHERE id=$1 AND user_id=$2',
    [id, user.userId]
  )
  if (!invRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { rows: photoRows } = await query(
    'SELECT * FROM inv_photos WHERE inventory_id=$1 ORDER BY uploaded_at ASC',
    [id]
  )

  return NextResponse.json({
    ...toInventory(invRows[0]),
    photos: photoRows.map(toPhoto),
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Fetch current values, then overlay with any provided fields
  const { rows: current } = await query('SELECT * FROM inv_items WHERE id=$1 AND user_id=$2', [id, user.userId])
  if (!current.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cur = current[0]
  const { rows } = await query(
    `UPDATE inv_items SET property_address=$1, type=$2, created_by=$3, notes=$4
     WHERE id=$5 AND user_id=$6 RETURNING *`,
    [
      body.propertyAddress ?? cur.property_address,
      body.type ?? cur.type,
      body.createdBy ?? cur.created_by,
      body.notes !== undefined ? body.notes : cur.notes,
      id, user.userId
    ]
  )
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(toInventory(rows[0]))
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await query('DELETE FROM inv_items WHERE id=$1 AND user_id=$2', [id, user.userId])
  return NextResponse.json({ success: true })
}
