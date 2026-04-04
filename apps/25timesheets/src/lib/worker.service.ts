import { query } from './db'

export interface TsWorker {
  id: string
  user_id: string
  entity_id: string
  worker_user_id: string
  manager_user_id: string | null
  employee_number: string | null
  hourly_rate: number | null
  currency: string
  employment_type: string
  contracted_weekly_minutes: number | null
  default_site_id: string | null
  can_work_overtime: boolean
  overtime_rate_override: number | null
  allowed_site_ids: string[] | null
  is_active: boolean
  full_name?: string
  email?: string
}

export async function getWorkerConfig(workerUserId: string, entityId: string): Promise<TsWorker | null> {
  const r = await query(
    `SELECT * FROM ts_workers WHERE worker_user_id = $1 AND entity_id = $2`,
    [workerUserId, entityId]
  )
  return r.rows[0] || null
}

export async function createWorker(data: {
  userId: string; entityId: string; workerUserId: string;
  employeeNumber?: string; hourlyRate?: number; employmentType?: string;
  defaultSiteId?: string; managerUserId?: string
}): Promise<TsWorker> {
  const r = await query(
    `INSERT INTO ts_workers (user_id, entity_id, worker_user_id, employee_number, hourly_rate, employment_type, default_site_id, manager_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.userId, data.entityId, data.workerUserId, data.employeeNumber || null,
     data.hourlyRate || null, data.employmentType || 'full_time',
     data.defaultSiteId || null, data.managerUserId || null]
  )
  return r.rows[0]
}

export async function updateWorker(workerId: string, userId: string, data: Record<string, unknown>): Promise<TsWorker | null> {
  const allowed = ['employee_number', 'hourly_rate', 'currency', 'employment_type', 'contracted_weekly_minutes',
    'default_site_id', 'can_work_overtime', 'overtime_rate_override', 'allowed_site_ids',
    'require_photo_override', 'gps_ping_override', 'break_rule_overrides', 'overtime_rule_overrides',
    'start_date', 'end_date', 'is_active', 'notes', 'manager_user_id']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return null

  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const r = await query(
    `UPDATE ts_workers SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [workerId, userId, ...fields.map(([, v]) => v)]
  )
  return r.rows[0] || null
}

export async function listWorkers(userId: string, entityId: string): Promise<TsWorker[]> {
  const r = await query(
    `SELECT tw.*, u.full_name, u.email
     FROM ts_workers tw
     JOIN users u ON tw.worker_user_id = u.id
     WHERE tw.user_id = $1 AND tw.entity_id = $2
     ORDER BY u.full_name`,
    [userId, entityId]
  )
  return r.rows
}
