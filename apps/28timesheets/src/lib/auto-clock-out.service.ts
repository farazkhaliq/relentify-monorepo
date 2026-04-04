import { query } from './db'
import { logAudit } from './audit.service'
import { evaluateBreakCompliance } from './break-rules.service'
import { calculateOvertime } from './overtime.service'
import { calculateTrustScore } from './trust-score.service'

export async function processAutoClockOuts(): Promise<{ processed: number; deductions: number }> {
  // Find all active entries that should be auto-clocked out
  const activeResult = await query(
    `SELECT te.*, ts.end_time as shift_end,
       tset.auto_clock_out_enabled, tset.auto_clock_out_after_minutes,
       tset.auto_clock_out_at_shift_end, tset.deduction_mode, tset.deduction_type,
       tset.fixed_deduction_minutes
     FROM ts_entries te
     LEFT JOIN ts_shifts ts ON te.shift_id = ts.id
     LEFT JOIN ts_settings tset ON te.user_id = tset.user_id AND te.entity_id = tset.entity_id
     WHERE te.clock_out_at IS NULL`
  )

  let processed = 0
  let totalDeductions = 0

  for (const entry of activeResult.rows) {
    const clockInTime = new Date(entry.clock_in_at).getTime()
    const elapsedMinutes = (Date.now() - clockInTime) / 60000
    const maxMinutes = entry.auto_clock_out_after_minutes || 720
    let shouldClockOut = false

    // Check max hours
    if (entry.auto_clock_out_enabled !== false && elapsedMinutes > maxMinutes) {
      shouldClockOut = true
    }

    // Check shift end
    if (entry.auto_clock_out_at_shift_end && entry.shift_end) {
      const shiftEndTime = new Date(entry.shift_end).getTime()
      if (Date.now() > shiftEndTime + 15 * 60000) { // 15 min grace
        shouldClockOut = true
      }
    }

    if (!shouldClockOut) continue

    // Calculate deduction
    let deductionMinutes = 0
    const mode = entry.deduction_mode || 'flag_for_review'

    if (mode === 'auto') {
      if (entry.deduction_type === 'fixed') {
        deductionMinutes = entry.fixed_deduction_minutes || 0
      } else {
        // Dynamic: deduct from last GPS ping inside geofence
        const lastPing = await query(
          `SELECT captured_at FROM ts_gps_pings WHERE entry_id = $1 AND is_within_geofence = true
           ORDER BY captured_at DESC LIMIT 1`,
          [entry.id]
        )
        if (lastPing.rows[0]) {
          const lastInFence = new Date(lastPing.rows[0].captured_at).getTime()
          deductionMinutes = Math.floor((Date.now() - lastInFence) / 60000)
        }
      }
    }

    // Calculate break totals
    const breakResult = await query(
      `SELECT COALESCE(SUM(duration_minutes), 0)::int as total FROM ts_breaks WHERE entry_id = $1 AND end_at IS NOT NULL`,
      [entry.id]
    )
    const totalBreakMinutes = breakResult.rows[0]?.total || 0
    const rawMinutes = Math.floor(elapsedMinutes)
    const totalWorkedMinutes = Math.max(0, rawMinutes - totalBreakMinutes - deductionMinutes)

    // Update entry
    await query(
      `UPDATE ts_entries SET
         clock_out_at = NOW(), auto_clocked_out = true,
         deduction_minutes = $2, deduction_reason = $3,
         total_break_minutes = $4, total_worked_minutes = $5,
         status = 'pending_approval', updated_at = NOW()
       WHERE id = $1`,
      [entry.id, deductionMinutes,
       deductionMinutes > 0 ? `Auto clock-out: ${deductionMinutes} min deduction` : 'Auto clock-out',
       totalBreakMinutes, totalWorkedMinutes]
    )

    // Close any open breaks
    await query(
      `UPDATE ts_breaks SET end_at = NOW(), duration_minutes = EXTRACT(EPOCH FROM NOW() - start_at)::int / 60
       WHERE entry_id = $1 AND end_at IS NULL`,
      [entry.id]
    )

    // Complete linked shift
    if (entry.shift_id) {
      await query(`UPDATE ts_shifts SET status = 'completed', updated_at = NOW() WHERE id = $1`, [entry.shift_id])
    }

    // Post-processing
    await evaluateBreakCompliance(entry.id)
    const date = new Date(entry.clock_in_at).toISOString().split('T')[0]
    await calculateOvertime(entry.worker_user_id, entry.entity_id, date)
    await calculateTrustScore(entry.id)

    logAudit({
      userId: entry.user_id, entityId: entry.entity_id, actorUserId: 'system',
      action: 'auto_clock_out', targetType: 'entry', targetId: entry.id,
      details: { deductionMinutes, totalWorkedMinutes },
    })

    processed++
    totalDeductions += deductionMinutes
  }

  return { processed, deductions: totalDeductions }
}
