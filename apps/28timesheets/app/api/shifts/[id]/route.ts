import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { updateShift, cancelShift } from '@/src/lib/shift.service'
import { query } from '@/src/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const r = await query(
    `SELECT s.*, u.full_name as worker_name, site.name as site_name
     FROM ts_shifts s JOIN users u ON s.worker_user_id = u.id LEFT JOIN ts_sites site ON s.site_id = site.id
     WHERE s.id = $1 AND s.user_id = $2`,
    [id, entity.user_id]
  )
  if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ shift: r.rows[0] })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'scheduling', 'create')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const body = await req.json()
  const shift = await updateShift(id, entity.user_id, body)
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ shift })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'scheduling', 'create')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  await cancelShift(id, entity.user_id)
  return NextResponse.json({ success: true })
}
