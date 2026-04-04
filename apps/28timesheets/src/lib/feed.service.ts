import { query } from './db'

export interface FeedEvent {
  id: string; event_type: string; created_at: string; source_table: string
  worker_user_id: string; entry_id: string | null; shift_id: string | null
  worker_name: string; clock_in_at: string | null; clock_out_at: string | null
  entry_status: string | null; trust_score: number | null; total_worked_minutes: number | null
  overtime_minutes: number | null; auto_clocked_out: boolean | null
  is_within_geofence_in: boolean | null; site_name: string | null; comment_count: number
}

export async function getFeed(params: {
  userId: string; entityId: string; role: string; currentUserId: string
  workerId?: string; page?: number; limit?: number
}): Promise<{ events: FeedEvent[]; total: number; hasMore: boolean }> {
  const conditions = ['fe.entity_id = $1']
  const queryParams: unknown[] = [params.entityId]
  let idx = 2

  // Role scoping
  if (params.role === 'staff') {
    conditions.push(`fe.worker_user_id = $${idx++}`)
    queryParams.push(params.currentUserId)
  }
  if (params.workerId) {
    conditions.push(`fe.worker_user_id = $${idx++}`)
    queryParams.push(params.workerId)
  }

  const where = conditions.join(' AND ')
  const limit = params.limit || 20
  const offset = ((params.page || 1) - 1) * limit

  const dataResult = await query(
    `SELECT fe.id, fe.event_type, fe.created_at, fe.source_table,
       fe.worker_user_id, fe.entry_id, fe.shift_id,
       u.full_name as worker_name,
       e.clock_in_at, e.clock_out_at, e.status as entry_status,
       e.trust_score, e.total_worked_minutes, e.overtime_minutes,
       e.deduction_minutes, e.auto_clocked_out,
       e.is_within_geofence_in, e.is_within_geofence_out,
       site.name as site_name,
       COALESCE((SELECT COUNT(*)::int FROM ts_comments c WHERE c.entry_id = fe.entry_id), 0) as comment_count
     FROM ts_feed_events fe
     LEFT JOIN ts_entries e ON fe.entry_id = e.id
     LEFT JOIN ts_shifts s ON fe.shift_id = s.id
     LEFT JOIN users u ON fe.worker_user_id = u.id
     LEFT JOIN ts_sites site ON e.site_id = site.id
     WHERE ${where}
     ORDER BY fe.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...queryParams, limit, offset]
  )

  const countResult = await query(
    `SELECT COUNT(*)::int as total FROM ts_feed_events fe WHERE ${where}`,
    queryParams
  )
  const total = countResult.rows[0]?.total || 0

  return {
    events: dataResult.rows,
    total,
    hasMore: offset + limit < total,
  }
}
