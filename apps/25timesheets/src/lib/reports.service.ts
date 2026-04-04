import { query } from './db'

export async function payrollSummary(userId: string, entityId: string, periodStart: string, periodEnd: string) {
  const r = await query(
    `SELECT
       tw.employee_number, u.full_name, tw.hourly_rate, tw.currency,
       COALESCE(SUM(te.total_worked_minutes), 0)::int as regular_minutes,
       COALESCE(SUM(te.overtime_minutes), 0)::int as overtime_minutes,
       COALESCE(SUM(te.deduction_minutes), 0)::int as deduction_minutes,
       COALESCE(SUM(te.total_break_minutes), 0)::int as break_minutes,
       COALESCE(AVG(te.trust_score), 0)::int as trust_score_avg,
       COUNT(te.id)::int as entry_count
     FROM ts_workers tw
     JOIN users u ON tw.worker_user_id = u.id
     LEFT JOIN ts_entries te ON te.worker_user_id = tw.worker_user_id AND te.entity_id = tw.entity_id
       AND te.status IN ('approved', 'locked') AND te.clock_in_at >= $3 AND te.clock_in_at < $4
     WHERE tw.user_id = $1 AND tw.entity_id = $2
     GROUP BY tw.id, tw.employee_number, u.full_name, tw.hourly_rate, tw.currency`,
    [userId, entityId, periodStart, periodEnd]
  )

  return r.rows.map((row: Record<string, unknown>) => {
    const rate = Number(row.hourly_rate) || 0
    const regularMinutes = Math.max(0, Number(row.regular_minutes) - Number(row.overtime_minutes))
    const regularPay = (regularMinutes / 60) * rate
    const overtimePay = (Number(row.overtime_minutes) / 60) * rate * 1.5
    return { ...row, regular_pay: Math.round(regularPay * 100) / 100, overtime_pay: Math.round(overtimePay * 100) / 100, total_pay: Math.round((regularPay + overtimePay) * 100) / 100 }
  })
}

export async function attendanceReport(userId: string, entityId: string, dateFrom: string, dateTo: string) {
  const r = await query(
    `SELECT te.worker_user_id, u.full_name, te.clock_in_at::date as date,
       te.clock_in_at, te.clock_out_at, te.total_worked_minutes, te.total_break_minutes,
       te.overtime_minutes, te.trust_score, te.status,
       s.start_time as shift_start, s.end_time as shift_end,
       CASE WHEN s.id IS NOT NULL AND te.clock_in_at > s.start_time THEN true ELSE false END as is_late
     FROM ts_entries te
     JOIN users u ON te.worker_user_id = u.id
     LEFT JOIN ts_shifts s ON te.shift_id = s.id
     WHERE te.user_id = $1 AND te.entity_id = $2 AND te.clock_in_at >= $3 AND te.clock_in_at < $4
     ORDER BY te.clock_in_at`,
    [userId, entityId, dateFrom, dateTo]
  )
  return r.rows
}

export async function hoursReport(userId: string, entityId: string, dateFrom: string, dateTo: string) {
  const r = await query(
    `SELECT tw.worker_user_id, u.full_name,
       COALESCE(SUM(te.total_worked_minutes), 0)::int as total_minutes,
       COALESCE(SUM(te.overtime_minutes), 0)::int as overtime_minutes,
       COUNT(te.id)::int as shift_count
     FROM ts_workers tw JOIN users u ON tw.worker_user_id = u.id
     LEFT JOIN ts_entries te ON te.worker_user_id = tw.worker_user_id AND te.entity_id = tw.entity_id
       AND te.clock_in_at >= $3 AND te.clock_in_at < $4
     WHERE tw.user_id = $1 AND tw.entity_id = $2
     GROUP BY tw.worker_user_id, u.full_name ORDER BY u.full_name`,
    [userId, entityId, dateFrom, dateTo]
  )
  return r.rows
}

export async function wageLeakageReport(userId: string, entityId: string, dateFrom: string, dateTo: string) {
  const [outside, late, deductions, lowTrust] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_worked_minutes), 0)::int as minutes FROM ts_entries
       WHERE user_id = $1 AND entity_id = $2 AND clock_in_at >= $3 AND clock_in_at < $4
       AND is_within_geofence_out = false`, [userId, entityId, dateFrom, dateTo]
    ),
    query(
      `SELECT COUNT(*)::int as count, COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_in_at - s.start_time))/60), 0)::int as minutes
       FROM ts_entries te JOIN ts_shifts s ON te.shift_id = s.id
       WHERE te.user_id = $1 AND te.entity_id = $2 AND te.clock_in_at >= $3 AND te.clock_in_at < $4
       AND te.clock_in_at > s.start_time`, [userId, entityId, dateFrom, dateTo]
    ),
    query(
      `SELECT COALESCE(SUM(deduction_minutes), 0)::int as minutes FROM ts_entries
       WHERE user_id = $1 AND entity_id = $2 AND clock_in_at >= $3 AND clock_in_at < $4
       AND deduction_minutes > 0`, [userId, entityId, dateFrom, dateTo]
    ),
    query(
      `SELECT COUNT(*)::int as count FROM ts_entries
       WHERE user_id = $1 AND entity_id = $2 AND clock_in_at >= $3 AND clock_in_at < $4
       AND trust_score < 50`, [userId, entityId, dateFrom, dateTo]
    ),
  ])

  const avgRate = await query(
    `SELECT COALESCE(AVG(hourly_rate), 15)::numeric as rate FROM ts_workers WHERE user_id = $1 AND entity_id = $2`,
    [userId, entityId]
  )
  const rate = Number(avgRate.rows[0]?.rate) || 15
  const savedMinutes = (deductions.rows[0]?.minutes || 0) + (outside.rows[0]?.minutes || 0)
  const estimatedSavings = Math.round((savedMinutes / 60) * rate * 100) / 100

  return {
    hoursOutsideGeofence: Math.round((outside.rows[0]?.minutes || 0) / 60 * 10) / 10,
    lateArrivals: late.rows[0]?.count || 0,
    lateMinutes: late.rows[0]?.minutes || 0,
    autoDeductionMinutes: deductions.rows[0]?.minutes || 0,
    lowTrustEntries: lowTrust.rows[0]?.count || 0,
    estimatedSavings,
  }
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
  }
  return lines.join('\n')
}
