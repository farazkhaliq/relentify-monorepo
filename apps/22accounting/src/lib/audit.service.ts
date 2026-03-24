import { query } from './db';

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  actorId?: string
) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, actor_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, action, entityType, entityId || null, metadata ? JSON.stringify(metadata) : null, actorId || null]
    );
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

export async function getAuditLog(userId: string, limit = 100) {
  const r = await query(
    `SELECT id, action, entity_type, entity_id, metadata, created_at
     FROM audit_log WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows;
}
