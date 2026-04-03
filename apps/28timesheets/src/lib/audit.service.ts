import { query } from './db'

export async function logAudit(data: {
  userId: string
  entityId: string
  actorUserId: string
  action: string
  targetType: string
  targetId?: string
  details?: object
}): Promise<void> {
  // Fire and forget — don't let audit failures block the operation
  query(
    `INSERT INTO ts_audit_log (user_id, entity_id, actor_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.userId, data.entityId, data.actorUserId, data.action, data.targetType, data.targetId || null, data.details ? JSON.stringify(data.details) : null]
  ).catch(() => {})
}
