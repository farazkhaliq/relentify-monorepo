import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/inventory/db'
import { toPhoto } from '@/lib/services/inventory/types'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const inventoryId = formData.get('inventoryId') as string
  const room = formData.get('room') as string
  const condition = (formData.get('condition') as string) || 'Good'
  const description = (formData.get('description') as string) || ''
  const imageData = formData.get('imageData') as string | null

  if (!inventoryId || !room) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { rows } = await query(
    `INSERT INTO inv_photos (inventory_id, room, condition, description, image_data)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [inventoryId, room, condition, description || null, imageData || null]
  )

  return NextResponse.json(toPhoto(rows[0]), { status: 201 })
}
