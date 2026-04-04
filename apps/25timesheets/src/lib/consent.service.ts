import { query } from './db'
import { logAudit } from './audit.service'

export async function hasConsented(workerUserId: string, entityId: string): Promise<boolean> {
  const r = await query(
    `SELECT EXISTS(
      SELECT 1 FROM ts_audit_log WHERE actor_user_id = $1 AND entity_id = $2 AND action = 'gdpr_consent_given'
    ) as consented`,
    [workerUserId, entityId]
  )
  return r.rows[0]?.consented || false
}

export async function recordConsent(workerUserId: string, entityId: string, ip: string): Promise<void> {
  await logAudit({
    userId: workerUserId,
    entityId,
    actorUserId: workerUserId,
    action: 'gdpr_consent_given',
    targetType: 'consent',
    details: { ip, timestamp: new Date().toISOString() },
  })
}
