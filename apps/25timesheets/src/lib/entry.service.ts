import { query } from './db'

export interface TsEntry {
  id: string
  user_id: string
  entity_id: string
  shift_id: string | null
  worker_user_id: string
  site_id: string | null
  project_tag: string | null
  clock_in_at: string
  clock_out_at: string | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  clock_in_ip: string | null
  clock_out_ip: string | null
  clock_in_device: object | null
  clock_out_device: object | null
  clock_in_photo_url: string | null
  clock_out_photo_url: string | null
  clock_in_photo_hash: string | null
  clock_out_photo_hash: string | null
  is_within_geofence_in: boolean | null
  is_within_geofence_out: boolean | null
  auto_clocked_out: boolean
  deduction_minutes: number
  deduction_reason: string | null
  total_break_minutes: number
  total_worked_minutes: number
  overtime_minutes: number
  trust_score: number
  gps_ping_count: number
  gps_pings_in_fence: number
  gps_verification_pct: number | null
  idempotency_key: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
}

export async function getActiveEntry(workerId: string, entityId: string): Promise<TsEntry | null> {
  const r = await query(
    `SELECT * FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL
     ORDER BY clock_in_at DESC LIMIT 1`,
    [workerId, entityId]
  )
  return r.rows[0] || null
}

export async function getEntryById(entryId: string, userId: string, entityId: string): Promise<TsEntry | null> {
  const r = await query(
    `SELECT * FROM ts_entries WHERE id = $1 AND user_id = $2 AND entity_id = $3`,
    [entryId, userId, entityId]
  )
  return r.rows[0] || null
}

export async function listEntries(filters: {
  userId: string; entityId: string;
  workerId?: string; status?: string; siteId?: string;
  dateFrom?: string; dateTo?: string;
  page?: number; limit?: number;
}): Promise<{ entries: TsEntry[]; total: number }> {
  const conditions = ['user_id = $1', 'entity_id = $2']
  const params: unknown[] = [filters.userId, filters.entityId]
  let idx = 3

  if (filters.workerId) {
    conditions.push(`worker_user_id = $${idx++}`)
    params.push(filters.workerId)
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`)
    params.push(filters.status)
  }
  if (filters.siteId) {
    conditions.push(`site_id = $${idx++}`)
    params.push(filters.siteId)
  }
  if (filters.dateFrom) {
    conditions.push(`clock_in_at >= $${idx++}`)
    params.push(filters.dateFrom)
  }
  if (filters.dateTo) {
    conditions.push(`clock_in_at < $${idx++}`)
    params.push(filters.dateTo)
  }

  const where = conditions.join(' AND ')
  const limit = filters.limit || 50
  const offset = ((filters.page || 1) - 1) * limit

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM ts_entries WHERE ${where} ORDER BY clock_in_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int as total FROM ts_entries WHERE ${where}`, params),
  ])

  return {
    entries: dataResult.rows,
    total: countResult.rows[0]?.total || 0,
  }
}
