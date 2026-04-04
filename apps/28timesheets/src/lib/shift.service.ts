import { query } from './db'
import { logAudit } from './audit.service'

export interface TsShift {
  id: string; user_id: string; entity_id: string; template_id: string | null
  site_id: string | null; worker_user_id: string; date: string
  start_time: string; end_time: string; notes: string | null; status: string
  worker_name?: string; site_name?: string
}

export async function createShift(data: {
  userId: string; entityId: string; workerUserId: string; siteId?: string
  date: string; startTime: string; endTime: string; notes?: string; templateId?: string
}): Promise<TsShift> {
  // Check for conflicts
  const conflicts = await query(
    `SELECT id FROM ts_shifts
     WHERE worker_user_id = $1 AND date = $2 AND status != 'cancelled'
     AND (start_time, end_time) OVERLAPS ($3::timestamptz, $4::timestamptz)`,
    [data.workerUserId, data.date, data.startTime, data.endTime]
  )
  if (conflicts.rows[0]) throw new Error('Shift conflict: overlapping shift exists')

  const r = await query(
    `INSERT INTO ts_shifts (user_id, entity_id, worker_user_id, site_id, date, start_time, end_time, notes, template_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.userId, data.entityId, data.workerUserId, data.siteId || null,
     data.date, data.startTime, data.endTime, data.notes || null, data.templateId || null]
  )
  logAudit({ userId: data.userId, entityId: data.entityId, actorUserId: data.userId, action: 'shift.created', targetType: 'shift', targetId: r.rows[0].id })
  return r.rows[0]
}

export async function bulkCreateShifts(data: {
  userId: string; entityId: string; workerUserIds: string[]
  siteId?: string; dateFrom: string; dateTo: string
  startTime: string; endTime: string; days?: number[]
}): Promise<TsShift[]> {
  const shifts: TsShift[] = []
  const start = new Date(data.dateFrom)
  const end = new Date(data.dateTo)
  const allowedDays = data.days || [1, 2, 3, 4, 5] // Mon-Fri default

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!allowedDays.includes(d.getDay() === 0 ? 7 : d.getDay())) continue
    const dateStr = d.toISOString().split('T')[0]
    for (const workerId of data.workerUserIds) {
      try {
        const shift = await createShift({
          userId: data.userId, entityId: data.entityId, workerUserId: workerId,
          siteId: data.siteId, date: dateStr,
          startTime: `${dateStr}T${data.startTime}`, endTime: `${dateStr}T${data.endTime}`,
        })
        shifts.push(shift)
      } catch {
        // Skip conflicts
      }
    }
  }
  return shifts
}

export async function listShifts(filters: {
  userId: string; entityId: string; workerId?: string; siteId?: string
  dateFrom?: string; dateTo?: string; status?: string; page?: number; limit?: number
}): Promise<{ shifts: TsShift[]; total: number }> {
  const conditions = ['s.user_id = $1', 's.entity_id = $2']
  const params: unknown[] = [filters.userId, filters.entityId]
  let idx = 3
  if (filters.workerId) { conditions.push(`s.worker_user_id = $${idx++}`); params.push(filters.workerId) }
  if (filters.siteId) { conditions.push(`s.site_id = $${idx++}`); params.push(filters.siteId) }
  if (filters.dateFrom) { conditions.push(`s.date >= $${idx++}`); params.push(filters.dateFrom) }
  if (filters.dateTo) { conditions.push(`s.date <= $${idx++}`); params.push(filters.dateTo) }
  if (filters.status) { conditions.push(`s.status = $${idx++}`); params.push(filters.status) }
  const where = conditions.join(' AND ')
  const limit = filters.limit || 50
  const offset = ((filters.page || 1) - 1) * limit

  const [data, count] = await Promise.all([
    query(
      `SELECT s.*, u.full_name as worker_name, site.name as site_name
       FROM ts_shifts s JOIN users u ON s.worker_user_id = u.id LEFT JOIN ts_sites site ON s.site_id = site.id
       WHERE ${where} ORDER BY s.date, s.start_time LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int as total FROM ts_shifts s WHERE ${where}`, params),
  ])
  return { shifts: data.rows, total: count.rows[0]?.total || 0 }
}

export async function getWorkerShifts(workerId: string, entityId: string, dateFrom?: string): Promise<TsShift[]> {
  const r = await query(
    `SELECT s.*, site.name as site_name FROM ts_shifts s LEFT JOIN ts_sites site ON s.site_id = site.id
     WHERE s.worker_user_id = $1 AND s.entity_id = $2 AND s.date >= COALESCE($3, CURRENT_DATE) AND s.status != 'cancelled'
     ORDER BY s.date, s.start_time`,
    [workerId, entityId, dateFrom || null]
  )
  return r.rows
}

export async function cancelShift(shiftId: string, userId: string): Promise<void> {
  await query(`UPDATE ts_shifts SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2`, [shiftId, userId])
  logAudit({ userId, entityId: '', actorUserId: userId, action: 'shift.cancelled', targetType: 'shift', targetId: shiftId })
}

export async function updateShift(shiftId: string, userId: string, data: Record<string, unknown>): Promise<TsShift | null> {
  const allowed = ['site_id', 'date', 'start_time', 'end_time', 'notes', 'status']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return null
  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const r = await query(
    `UPDATE ts_shifts SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [shiftId, userId, ...fields.map(([, v]) => v)]
  )
  return r.rows[0] || null
}
