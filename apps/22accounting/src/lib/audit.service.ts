import { query } from './db'

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  actorId?: string,
  workspaceEntityId?: string
) {
  try {
    await query(
      `INSERT INTO audit_log
         (user_id, action, entity_type, entity_id, metadata, actor_id, workspace_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId, action, entityType,
        entityId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        actorId ?? null,
        workspaceEntityId ?? null,
      ]
    )
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

export async function getAuditLog(
  userId: string,
  entityId?: string,
  limit = 100
) {
  const params: unknown[] = [userId]
  let sql = `
    SELECT id, action, entity_type, entity_id, metadata,
           actor_id, workspace_entity_id, created_at
    FROM audit_log WHERE user_id=$1`

  if (entityId) {
    params.push(entityId)
    sql += ` AND workspace_entity_id=$${params.length}`
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const r = await query(sql, params)
  return r.rows
}
