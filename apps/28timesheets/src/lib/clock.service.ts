import { query } from './db'
import { isWithinGeofence } from './geo.service'
import { logAudit } from './audit.service'
import { getWorkspaceSettings } from './settings.service'
import { TsEntry } from './entry.service'
import { evaluateBreakCompliance } from './break-rules.service'
import { calculateOvertime } from './overtime.service'
import { calculateTrustScore } from './trust-score.service'

export interface TsBreak {
  id: string
  entry_id: string
  start_at: string
  end_at: string | null
  break_type: string
  duration_minutes: number | null
}

export async function clockIn(data: {
  workerId: string; userId: string; entityId: string;
  latitude: number | null; longitude: number | null; ip: string;
  device: object; photoUrl?: string; photoHash?: string;
  siteId?: string; projectTag?: string; idempotencyKey?: string;
}): Promise<TsEntry> {
  // 1. Check idempotency key
  if (data.idempotencyKey) {
    const existing = await query(
      `SELECT * FROM ts_entries WHERE idempotency_key = $1`,
      [data.idempotencyKey]
    )
    if (existing.rows[0]) return existing.rows[0]
  }

  // 2. Check worker isn't already clocked in
  const active = await query(
    `SELECT id FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL`,
    [data.workerId, data.entityId]
  )
  if (active.rows[0]) {
    throw new Error('Already clocked in')
  }

  // 3. Check geofence if site provided
  let isWithinIn: boolean | null = null
  let siteId = data.siteId || null

  if (siteId && data.latitude != null && data.longitude != null) {
    const siteResult = await query(`SELECT * FROM ts_sites WHERE id = $1`, [siteId])
    const site = siteResult.rows[0]
    if (site && site.latitude && site.longitude) {
      const geo = isWithinGeofence(data.latitude, data.longitude, site)
      isWithinIn = geo.within
    }
  }

  // 4. Check for scheduled shift within early clock-in window
  const settings = await getWorkspaceSettings(data.userId, data.entityId)
  const earlyWindow = settings?.allow_early_clock_in_minutes || 15
  let shiftId: string | null = null

  const matchingShift = await query(
    `SELECT * FROM ts_shifts
     WHERE worker_user_id = $1 AND entity_id = $2 AND date = CURRENT_DATE AND status = 'scheduled'
     AND start_time BETWEEN NOW() - interval '${earlyWindow} minutes' AND NOW() + interval '${earlyWindow} minutes'
     LIMIT 1`,
    [data.workerId, data.entityId]
  )
  if (matchingShift.rows[0]) {
    shiftId = matchingShift.rows[0].id
    if (!siteId && matchingShift.rows[0].site_id) {
      siteId = matchingShift.rows[0].site_id
    }
    await query(
      `UPDATE ts_shifts SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [shiftId]
    )
  }

  // 5. Insert entry
  const r = await query(
    `INSERT INTO ts_entries (
       user_id, entity_id, worker_user_id, shift_id, site_id, project_tag,
       clock_in_latitude, clock_in_longitude, clock_in_ip, clock_in_device,
       clock_in_photo_url, clock_in_photo_hash,
       is_within_geofence_in, idempotency_key, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
     RETURNING *`,
    [
      data.userId, data.entityId, data.workerId, shiftId, siteId,
      data.projectTag || null, data.latitude, data.longitude,
      data.ip, JSON.stringify(data.device),
      data.photoUrl || null, data.photoHash || null,
      isWithinIn, data.idempotencyKey || null,
    ]
  )

  logAudit({
    userId: data.userId, entityId: data.entityId, actorUserId: data.workerId,
    action: 'clock_in', targetType: 'entry', targetId: r.rows[0].id,
  })

  return r.rows[0]
}

export async function clockOut(data: {
  workerId: string; userId: string; entityId: string;
  latitude: number | null; longitude: number | null; ip: string;
  device: object; photoUrl?: string; photoHash?: string;
}): Promise<TsEntry> {
  // 1. Find active entry
  const activeResult = await query(
    `SELECT * FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL
     ORDER BY clock_in_at DESC LIMIT 1`,
    [data.workerId, data.entityId]
  )
  const entry = activeResult.rows[0]
  if (!entry) throw new Error('Not clocked in')

  // 2. Check geofence on clock-out
  let isWithinOut: boolean | null = null
  if (entry.site_id && data.latitude != null && data.longitude != null) {
    const siteResult = await query(`SELECT * FROM ts_sites WHERE id = $1`, [entry.site_id])
    const site = siteResult.rows[0]
    if (site && site.latitude && site.longitude) {
      const geo = isWithinGeofence(data.latitude, data.longitude, site)
      isWithinOut = geo.within
    }
  }

  // 3. Calculate total break minutes
  const breakResult = await query(
    `SELECT COALESCE(SUM(duration_minutes), 0)::int as total_breaks FROM ts_breaks WHERE entry_id = $1 AND end_at IS NOT NULL`,
    [entry.id]
  )
  const totalBreakMinutes = breakResult.rows[0]?.total_breaks || 0

  // 4. Calculate worked minutes
  const clockInTime = new Date(entry.clock_in_at).getTime()
  const clockOutTime = Date.now()
  const rawMinutes = Math.floor((clockOutTime - clockInTime) / 60000)
  const totalWorkedMinutes = Math.max(0, rawMinutes - totalBreakMinutes - (entry.deduction_minutes || 0))

  // 5. Update shift if linked
  if (entry.shift_id) {
    await query(
      `UPDATE ts_shifts SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [entry.shift_id]
    )
  }

  // 6. Update entry
  const r = await query(
    `UPDATE ts_entries SET
       clock_out_at = NOW(),
       clock_out_latitude = $2,
       clock_out_longitude = $3,
       clock_out_ip = $4,
       clock_out_device = $5,
       clock_out_photo_url = $6,
       clock_out_photo_hash = $7,
       is_within_geofence_out = $8,
       total_break_minutes = $9,
       total_worked_minutes = $10,
       status = 'pending_approval',
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      entry.id, data.latitude, data.longitude, data.ip,
      JSON.stringify(data.device), data.photoUrl || null,
      data.photoHash || null, isWithinOut,
      totalBreakMinutes, totalWorkedMinutes,
    ]
  )

  logAudit({
    userId: data.userId, entityId: data.entityId, actorUserId: data.workerId,
    action: 'clock_out', targetType: 'entry', targetId: entry.id,
  })

  // Post clock-out processing
  await evaluateBreakCompliance(entry.id)
  const date = new Date(entry.clock_in_at).toISOString().split('T')[0]
  await calculateOvertime(data.workerId, data.entityId, date)
  await calculateTrustScore(entry.id)

  // Re-fetch with updated values
  const updated = await query(`SELECT * FROM ts_entries WHERE id = $1`, [entry.id])
  return updated.rows[0] || r.rows[0]
}

export async function startBreak(data: {
  workerId: string; entityId: string;
  latitude: number | null; longitude: number | null; breakType: 'paid' | 'unpaid';
}): Promise<TsBreak> {
  // 1. Find active entry
  const activeResult = await query(
    `SELECT * FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL LIMIT 1`,
    [data.workerId, data.entityId]
  )
  const entry = activeResult.rows[0]
  if (!entry) throw new Error('Not clocked in')

  // 2. Check no break already in progress
  const existingBreak = await query(
    `SELECT id FROM ts_breaks WHERE entry_id = $1 AND end_at IS NULL`,
    [entry.id]
  )
  if (existingBreak.rows[0]) throw new Error('Break already in progress')

  // 3. Insert break
  const r = await query(
    `INSERT INTO ts_breaks (entry_id, break_type, start_latitude, start_longitude)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [entry.id, data.breakType, data.latitude, data.longitude]
  )

  return r.rows[0]
}

export async function endBreak(data: {
  workerId: string; entityId: string;
  latitude: number | null; longitude: number | null;
}): Promise<TsBreak> {
  // 1. Find active entry
  const activeResult = await query(
    `SELECT id FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL LIMIT 1`,
    [data.workerId, data.entityId]
  )
  const entry = activeResult.rows[0]
  if (!entry) throw new Error('Not clocked in')

  // 2. Find active break
  const breakResult = await query(
    `SELECT * FROM ts_breaks WHERE entry_id = $1 AND end_at IS NULL`,
    [entry.id]
  )
  const activeBreak = breakResult.rows[0]
  if (!activeBreak) throw new Error('No active break')

  // 3. Calculate duration
  const startTime = new Date(activeBreak.start_at).getTime()
  const durationMinutes = Math.floor((Date.now() - startTime) / 60000)

  // 4. Update break
  const r = await query(
    `UPDATE ts_breaks SET end_at = NOW(), duration_minutes = $2, end_latitude = $3, end_longitude = $4
     WHERE id = $1 RETURNING *`,
    [activeBreak.id, durationMinutes, data.latitude, data.longitude]
  )

  return r.rows[0]
}
