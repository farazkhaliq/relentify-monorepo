import { query } from './db'

export async function getLiveStatus(userId: string, entityId: string) {
  const r = await query(
    `SELECT te.id, te.worker_user_id, te.clock_in_at, te.site_id, te.trust_score,
       te.is_within_geofence_in, u.full_name as worker_name, s.name as site_name,
       EXISTS(SELECT 1 FROM ts_breaks WHERE entry_id = te.id AND end_at IS NULL) as is_on_break
     FROM ts_entries te
     JOIN users u ON te.worker_user_id = u.id
     LEFT JOIN ts_sites s ON te.site_id = s.id
     WHERE te.user_id = $1 AND te.entity_id = $2 AND te.clock_out_at IS NULL`,
    [userId, entityId]
  )
  const clockedIn = r.rows
  return {
    clockedIn,
    totalClockedIn: clockedIn.length,
    onBreak: clockedIn.filter((w: { is_on_break: boolean }) => w.is_on_break).length,
    unverifiedLocations: clockedIn.filter((w: { is_within_geofence_in: boolean | null }) => w.is_within_geofence_in === false).length,
  }
}

export async function getDailySummary(userId: string, entityId: string, date: string) {
  const [hours, pending, missed] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_worked_minutes), 0)::int as total_hours,
         COALESCE(SUM(overtime_minutes), 0)::int as total_overtime,
         COALESCE(SUM(deduction_minutes), 0)::int as total_deductions
       FROM ts_entries WHERE user_id = $1 AND entity_id = $2 AND clock_in_at::date = $3`,
      [userId, entityId, date]
    ),
    query(
      `SELECT COUNT(*)::int as count FROM ts_entries WHERE user_id = $1 AND entity_id = $2 AND status = 'pending_approval'`,
      [userId, entityId]
    ),
    query(
      `SELECT COUNT(*)::int as count FROM ts_shifts WHERE user_id = $1 AND entity_id = $2 AND date = $3 AND status = 'scheduled'`,
      [userId, entityId, date]
    ),
  ])
  return {
    totalHours: hours.rows[0]?.total_hours || 0,
    totalOvertime: hours.rows[0]?.total_overtime || 0,
    totalDeductions: hours.rows[0]?.total_deductions || 0,
    pendingApprovals: pending.rows[0]?.count || 0,
    missedShifts: missed.rows[0]?.count || 0,
  }
}
