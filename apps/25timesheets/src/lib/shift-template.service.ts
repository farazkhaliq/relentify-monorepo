import { query } from './db'

export interface TsShiftTemplate {
  id: string; user_id: string; entity_id: string; site_id: string | null
  name: string; start_time: string; end_time: string; break_minutes: number
  is_paid_break: boolean; recurrence: object | null
}

export async function createTemplate(data: {
  userId: string; entityId: string; siteId?: string; name: string
  startTime: string; endTime: string; breakMinutes?: number
  isPaidBreak?: boolean; recurrence?: object
}): Promise<TsShiftTemplate> {
  const r = await query(
    `INSERT INTO ts_shift_templates (user_id, entity_id, site_id, name, start_time, end_time, break_minutes, is_paid_break, recurrence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.userId, data.entityId, data.siteId || null, data.name,
     data.startTime, data.endTime, data.breakMinutes || 0,
     data.isPaidBreak || false, data.recurrence ? JSON.stringify(data.recurrence) : null]
  )
  return r.rows[0]
}

export async function listTemplates(userId: string, entityId: string): Promise<TsShiftTemplate[]> {
  const r = await query(
    `SELECT * FROM ts_shift_templates WHERE user_id = $1 AND entity_id = $2 ORDER BY name`,
    [userId, entityId]
  )
  return r.rows
}

export async function updateTemplate(templateId: string, userId: string, data: Record<string, unknown>): Promise<TsShiftTemplate | null> {
  const allowed = ['name', 'site_id', 'start_time', 'end_time', 'break_minutes', 'is_paid_break', 'recurrence']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return null
  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const values = fields.map(([k, v]) => k === 'recurrence' && v ? JSON.stringify(v) : v)
  const r = await query(
    `UPDATE ts_shift_templates SET ${setClauses} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [templateId, userId, ...values]
  )
  return r.rows[0] || null
}

export async function deleteTemplate(templateId: string, userId: string): Promise<boolean> {
  const r = await query(`DELETE FROM ts_shift_templates WHERE id = $1 AND user_id = $2`, [templateId, userId])
  return (r.rowCount ?? 0) > 0
}
