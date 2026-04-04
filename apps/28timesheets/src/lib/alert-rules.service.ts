import { query } from './db'
import { sendToManagers } from './notification.service'

export async function evaluateAlerts(entityId: string): Promise<number> {
  const rules = await query(
    `SELECT * FROM ts_alert_rules WHERE entity_id = $1 AND is_active = true`,
    [entityId]
  )

  let triggered = 0

  for (const rule of rules.rows) {
    let shouldAlert = false
    let message = ''

    if (rule.alert_type === 'off_site_duration') {
      const offsite = await query(
        `SELECT te.worker_user_id, u.full_name,
           EXTRACT(EPOCH FROM NOW() - te.clock_in_at)::int / 60 as minutes_clocked
         FROM ts_entries te JOIN users u ON te.worker_user_id = u.id
         WHERE te.entity_id = $1 AND te.clock_out_at IS NULL AND te.is_within_geofence_in = false
         AND EXTRACT(EPOCH FROM NOW() - te.clock_in_at) / 60 > $2`,
        [entityId, rule.threshold_value]
      )
      if (offsite.rows.length > 0) {
        shouldAlert = true
        message = `${offsite.rows.length} worker(s) off-site for >${rule.threshold_value} min`
      }
    } else if (rule.alert_type === 'late_arrivals_week') {
      const late = await query(
        `SELECT COUNT(DISTINCT te.worker_user_id)::int as count
         FROM ts_entries te JOIN ts_shifts s ON te.shift_id = s.id
         WHERE te.entity_id = $1 AND te.clock_in_at > s.start_time
         AND EXTRACT(WEEK FROM te.clock_in_at) = EXTRACT(WEEK FROM NOW())`,
        [entityId]
      )
      if ((late.rows[0]?.count || 0) > rule.threshold_value) {
        shouldAlert = true
        message = `${late.rows[0].count} late arrivals this week (threshold: ${rule.threshold_value})`
      }
    } else if (rule.alert_type === 'pending_approvals_age') {
      const old = await query(
        `SELECT COUNT(*)::int as count FROM ts_entries
         WHERE entity_id = $1 AND status = 'pending_approval'
         AND clock_out_at < NOW() - INTERVAL '1 day' * $2`,
        [entityId, rule.threshold_value]
      )
      if ((old.rows[0]?.count || 0) > 0) {
        shouldAlert = true
        message = `${old.rows[0].count} pending approvals older than ${rule.threshold_value} days`
      }
    }

    if (shouldAlert) {
      await sendToManagers(entityId, {
        title: `Alert: ${rule.name}`,
        body: message,
        url: '/approvals',
      })
      triggered++
    }
  }

  return triggered
}
