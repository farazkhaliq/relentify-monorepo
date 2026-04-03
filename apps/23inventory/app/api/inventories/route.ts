import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { toInventory, toPhoto, InventoryRow, PhotoRow } from '@/lib/types'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows: invRows } = await query(
    'SELECT * FROM inv_items WHERE user_id=$1 ORDER BY created_at DESC',
    [user.userId]
  )
  const { rows: photoRows } = await query(
    'SELECT p.* FROM inv_photos p JOIN inv_items i ON p.inventory_id = i.id WHERE i.user_id=$1 ORDER BY p.uploaded_at ASC',
    [user.userId]
  )

  const photosByInv = new Map<string, PhotoRow[]>()
  for (const p of photoRows) {
    const arr = photosByInv.get(p.inventory_id) || []
    arr.push(p)
    photosByInv.set(p.inventory_id, arr)
  }

  const inventories = invRows.map((row: InventoryRow) => ({
    ...toInventory(row),
    photos: (photosByInv.get(row.id) || []).map(toPhoto),
  }))

  return NextResponse.json(inventories)
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyAddress, type, createdBy, notes, tenantEmail } = await request.json()
  if (!propertyAddress || !type || !createdBy) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { rows } = await query(
    `INSERT INTO inv_items (user_id, property_address, type, created_by, notes, tenant_email)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [user.userId, propertyAddress, type, createdBy, notes || null, tenantEmail || null]
  )
  return NextResponse.json(toInventory(rows[0]), { status: 201 })
}
