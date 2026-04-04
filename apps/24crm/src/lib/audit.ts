import pool from './pool'

export async function logAuditEvent(
  entityId: string,
  userId: string,
  action: 'Create' | 'Update' | 'Delete',
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO crm_audit_logs (entity_id, user_id, action, resource_type, resource_id, resource_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entityId, userId, action, resourceType, resourceId, resourceName || null, details ? JSON.stringify(details) : '{}']
    )
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
