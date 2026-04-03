import { query } from './db'

export interface TsSettings {
  id: string
  user_id: string
  entity_id: string
  require_gps: boolean
  require_photo: boolean
  gps_ping_interval_minutes: number
  auto_clock_out_enabled: boolean
  auto_clock_out_after_minutes: number
  auto_clock_out_at_shift_end: boolean
  deduction_mode: string
  deduction_type: string
  fixed_deduction_minutes: number | null
  project_tag_required: boolean
  allow_early_clock_in_minutes: number
  allow_late_clock_out_minutes: number
  gps_retention_days: number
  photo_retention_days: number
}

export async function getWorkspaceSettings(userId: string, entityId: string): Promise<TsSettings | null> {
  const r = await query(
    `SELECT * FROM ts_settings WHERE user_id = $1 AND entity_id = $2`,
    [userId, entityId]
  )
  return r.rows[0] || null
}

export async function upsertWorkspaceSettings(
  userId: string,
  entityId: string,
  data: Partial<TsSettings>
): Promise<TsSettings> {
  const fields = Object.entries(data).filter(([k]) => !['id', 'user_id', 'entity_id', 'created_at'].includes(k))
  if (fields.length === 0) {
    const existing = await getWorkspaceSettings(userId, entityId)
    if (existing) return existing
  }

  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const values = fields.map(([, v]) => v)

  const r = await query(
    `INSERT INTO ts_settings (user_id, entity_id${fields.length ? ', ' + fields.map(([k]) => k).join(', ') : ''})
     VALUES ($1, $2${fields.length ? ', ' + fields.map((_, i) => `$${i + 3}`).join(', ') : ''})
     ON CONFLICT (user_id, entity_id)
     DO UPDATE SET ${setClauses || 'updated_at = NOW()'}, updated_at = NOW()
     RETURNING *`,
    [userId, entityId, ...values]
  )
  return r.rows[0]
}
