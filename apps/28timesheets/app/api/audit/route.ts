import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { query } from '@/src/lib/db'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit
  const [data, count] = await Promise.all([
    query(
      `SELECT al.*, u.full_name as actor_name FROM ts_audit_log al
       LEFT JOIN users u ON al.actor_user_id = u.id
       WHERE al.entity_id = $1 ORDER BY al.created_at DESC LIMIT $2 OFFSET $3`,
      [entity.id, limit, offset]
    ),
    query(`SELECT COUNT(*)::int as total FROM ts_audit_log WHERE entity_id = $1`, [entity.id]),
  ])
  return NextResponse.json({ events: data.rows, total: count.rows[0]?.total || 0 })
}
