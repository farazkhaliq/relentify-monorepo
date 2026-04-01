import pool from '../pool'

export interface AuditLog {
  id: string
  entity_id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  details: Record<string, any>
  created_at: Date
  user_name?: string
}

export async function getAuditLogs(entityId: string, limit = 100): Promise<AuditLog[]> {
  const { rows } = await pool.query(
    `SELECT a.*, u.full_name as user_name FROM crm_audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE a.entity_id = $1 ORDER BY a.created_at DESC LIMIT $2`,
    [entityId, limit]
  )
  return rows
}
