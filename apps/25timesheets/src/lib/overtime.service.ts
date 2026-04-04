import { query } from './db'

export interface TsOvertimeRule {
  id: string; user_id: string; entity_id: string; name: string
  rule_type: string; threshold_minutes: number; multiplier: number
  conditions: object | null; priority: number; is_active: boolean
}

export async function calculateOvertime(workerId: string, entityId: string, date: string): Promise<void> {
  // Load active overtime rules
  const rulesResult = await query(
    `SELECT * FROM ts_overtime_rules WHERE entity_id = $1 AND is_active = true ORDER BY priority DESC`,
    [entityId]
  )
  const rules = rulesResult.rows

  for (const rule of rules) {
    if (rule.rule_type === 'daily') {
      // Sum worked minutes for this date
      const dayResult = await query(
        `SELECT COALESCE(SUM(total_worked_minutes), 0)::int as total
         FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2
         AND clock_in_at::date = $3 AND clock_out_at IS NOT NULL`,
        [workerId, entityId, date]
      )
      const totalMinutes = dayResult.rows[0]?.total || 0
      if (totalMinutes > rule.threshold_minutes) {
        const overtimeMinutes = totalMinutes - rule.threshold_minutes
        // Distribute to entries for this day
        await query(
          `UPDATE ts_entries SET overtime_minutes = GREATEST(0, total_worked_minutes - $4)
           WHERE worker_user_id = $1 AND entity_id = $2 AND clock_in_at::date = $3 AND clock_out_at IS NOT NULL`,
          [workerId, entityId, date, rule.threshold_minutes]
        )
      }
    } else if (rule.rule_type === 'weekly') {
      // Sum worked minutes for this ISO week
      const weekResult = await query(
        `SELECT COALESCE(SUM(total_worked_minutes), 0)::int as total
         FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2
         AND EXTRACT(ISOYEAR FROM clock_in_at) = EXTRACT(ISOYEAR FROM $3::date)
         AND EXTRACT(WEEK FROM clock_in_at) = EXTRACT(WEEK FROM $3::date)
         AND clock_out_at IS NOT NULL`,
        [workerId, entityId, date]
      )
      const weekTotal = weekResult.rows[0]?.total || 0
      if (weekTotal > rule.threshold_minutes) {
        // Mark the excess as overtime on the latest entry of the day
        const excess = weekTotal - rule.threshold_minutes
        await query(
          `UPDATE ts_entries SET overtime_minutes = $3
           WHERE id = (
             SELECT id FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2
             AND clock_in_at::date = $4 AND clock_out_at IS NOT NULL
             ORDER BY clock_out_at DESC LIMIT 1
           )`,
          [workerId, entityId, excess, date]
        )
      }
    }
  }
}

export async function createOvertimeRule(data: {
  userId: string; entityId: string; name: string; ruleType: string
  thresholdMinutes: number; multiplier: number; conditions?: object; priority?: number
}): Promise<TsOvertimeRule> {
  const r = await query(
    `INSERT INTO ts_overtime_rules (user_id, entity_id, name, rule_type, threshold_minutes, multiplier, conditions, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.userId, data.entityId, data.name, data.ruleType, data.thresholdMinutes,
     data.multiplier, data.conditions ? JSON.stringify(data.conditions) : null, data.priority || 0]
  )
  return r.rows[0]
}

export async function listOvertimeRules(userId: string, entityId: string): Promise<TsOvertimeRule[]> {
  const r = await query(
    `SELECT * FROM ts_overtime_rules WHERE user_id = $1 AND entity_id = $2 ORDER BY priority DESC`,
    [userId, entityId]
  )
  return r.rows
}

export async function updateOvertimeRule(ruleId: string, userId: string, data: Record<string, unknown>): Promise<TsOvertimeRule | null> {
  const allowed = ['name', 'rule_type', 'threshold_minutes', 'multiplier', 'conditions', 'priority', 'is_active']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return null
  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const values = fields.map(([k, v]) => k === 'conditions' && v ? JSON.stringify(v) : v)
  const r = await query(
    `UPDATE ts_overtime_rules SET ${setClauses} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [ruleId, userId, ...values]
  )
  return r.rows[0] || null
}

export async function deleteOvertimeRule(ruleId: string, userId: string): Promise<boolean> {
  const r = await query(`DELETE FROM ts_overtime_rules WHERE id = $1 AND user_id = $2`, [ruleId, userId])
  return (r.rowCount ?? 0) > 0
}
