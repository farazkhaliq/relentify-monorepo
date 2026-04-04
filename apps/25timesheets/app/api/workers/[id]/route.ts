import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { updateWorker } from '@/src/lib/worker.service'
import { query } from '@/src/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const r = await query(
    `SELECT tw.*, u.full_name, u.email FROM ts_workers tw JOIN users u ON tw.worker_user_id = u.id
     WHERE tw.id = $1 AND tw.user_id = $2 AND tw.entity_id = $3`,
    [id, entity.user_id, entity.id]
  )
  if (!r.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ worker: r.rows[0] })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'team', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { id } = await params
  const body = await req.json()
  const worker = await updateWorker(id, entity.user_id, body)
  if (!worker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ worker })
}
