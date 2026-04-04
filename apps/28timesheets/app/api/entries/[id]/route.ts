import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getEntryById } from '@/src/lib/entry.service'
import { query } from '@/src/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const entry = await getEntryById(id, entity.user_id, entity.id)
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Load breaks
  const breaks = await query(`SELECT * FROM ts_breaks WHERE entry_id = $1 ORDER BY start_at`, [id])
  return NextResponse.json({ entry, breaks: breaks.rows })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const existing = await getEntryById(id, entity.user_id, entity.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'locked') return NextResponse.json({ error: 'Entry is locked' }, { status: 403 })
  const body = await req.json()
  const allowed = ['notes', 'project_tag']
  const fields = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ entry: existing })
  const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ')
  const r = await query(
    `UPDATE ts_entries SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...fields.map(([, v]) => v)]
  )
  return NextResponse.json({ entry: r.rows[0] })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const existing = await getEntryById(id, entity.user_id, entity.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'locked') return NextResponse.json({ error: 'Cannot delete locked entry' }, { status: 403 })
  await query(`DELETE FROM ts_entries WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
