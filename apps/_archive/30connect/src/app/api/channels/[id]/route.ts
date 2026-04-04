import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { deleteChannel } from '@/lib/services/channel.service'
import pool from '@/lib/pool'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const sets: string[] = ['updated_at = NOW()']
  const p: any[] = []
  let idx = 1

  if (body.config !== undefined) { sets.push(`config = $${idx++}`); p.push(JSON.stringify(body.config)) }
  if (body.enabled !== undefined) { sets.push(`enabled = $${idx++}`); p.push(body.enabled) }

  p.push(id, user.activeEntityId)
  const result = await pool.query(
    `UPDATE connect_channels SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    p
  )
  if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result.rows[0])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const deleted = await deleteChannel(id, user.activeEntityId)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
