import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { query } from '@/src/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'settings', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const body = await req.json()
  const allowed = ['name', 'alert_type', 'threshold_value', 'is_active']
  const fields = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })
  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const r = await query(
    `UPDATE ts_alert_rules SET ${setClauses} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, entity.user_id, ...fields.map(([, v]) => v)]
  )
  if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ rule: r.rows[0] })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'settings', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  await query(`DELETE FROM ts_alert_rules WHERE id = $1 AND user_id = $2`, [id, entity.user_id])
  return NextResponse.json({ success: true })
}
