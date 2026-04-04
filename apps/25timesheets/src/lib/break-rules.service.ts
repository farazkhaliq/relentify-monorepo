import { query } from './db'

export interface TsBreakRule {
  id: string; user_id: string; entity_id: string; name: string
  after_worked_minutes: number; break_duration_minutes: number
  break_type: string; auto_deduct: boolean; is_active: boolean
}

export async function evaluateBreakCompliance(entryId: string): Promise<{ compliant: boolean; deductedMinutes: number }> {
  const entryResult = await query(`SELECT * FROM ts_entries WHERE id = $1`, [entryId])
  const entry = entryResult.rows[0]
  if (!entry) return { compliant: true, deductedMinutes: 0 }

  const rulesResult = await query(
    `SELECT * FROM ts_break_rules WHERE entity_id = $1 AND is_active = true ORDER BY after_worked_minutes`,
    [entry.entity_id]
  )

  const breaksResult = await query(
    `SELECT * FROM ts_breaks WHERE entry_id = $1 AND end_at IS NOT NULL`,
    [entryId]
  )
  const breaks = breaksResult.rows
  let totalDeducted = 0

  for (const rule of rulesResult.rows) {
    if (entry.total_worked_minutes > rule.after_worked_minutes) {
      // Check if worker took a sufficient break
      const matchingBreak = breaks.find((b: { break_type: string; duration_minutes: number }) =>
        b.break_type === rule.break_type && b.duration_minutes >= rule.break_duration_minutes
      )
      if (!matchingBreak && rule.auto_deduct) {
        totalDeducted += rule.break_duration_minutes
      }
    }
  }

  if (totalDeducted > 0) {
    await query(
      `UPDATE ts_entries SET
         total_break_minutes = total_break_minutes + $2,
         total_worked_minutes = GREATEST(0, total_worked_minutes - $2),
         updated_at = NOW()
       WHERE id = $1`,
      [entryId, totalDeducted]
    )
  }

  return { compliant: totalDeducted === 0, deductedMinutes: totalDeducted }
}

export async function createBreakRule(data: {
  userId: string; entityId: string; name: string; afterWorkedMinutes: number
  breakDurationMinutes: number; breakType: string; autoDeduct: boolean
}): Promise<TsBreakRule> {
  const r = await query(
    `INSERT INTO ts_break_rules (user_id, entity_id, name, after_worked_minutes, break_duration_minutes, break_type, auto_deduct)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.userId, data.entityId, data.name, data.afterWorkedMinutes, data.breakDurationMinutes, data.breakType, data.autoDeduct]
  )
  return r.rows[0]
}

export async function listBreakRules(userId: string, entityId: string): Promise<TsBreakRule[]> {
  const r = await query(
    `SELECT * FROM ts_break_rules WHERE user_id = $1 AND entity_id = $2 ORDER BY after_worked_minutes`,
    [userId, entityId]
  )
  return r.rows
}

export async function updateBreakRule(ruleId: string, userId: string, data: Record<string, unknown>): Promise<TsBreakRule | null> {
  const allowed = ['name', 'after_worked_minutes', 'break_duration_minutes', 'break_type', 'auto_deduct', 'is_active']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return null
  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const r = await query(
    `UPDATE ts_break_rules SET ${setClauses} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [ruleId, userId, ...fields.map(([, v]) => v)]
  )
  return r.rows[0] || null
}

export async function deleteBreakRule(ruleId: string, userId: string): Promise<boolean> {
  const r = await query(`DELETE FROM ts_break_rules WHERE id = $1 AND user_id = $2`, [ruleId, userId])
  return (r.rowCount ?? 0) > 0
}
