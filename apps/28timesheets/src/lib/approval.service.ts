import { query, withTransaction } from './db'
import { logAudit } from './audit.service'
import { TsEntry } from './entry.service'

export async function approveEntry(entryId: string, approverUserId: string, userId: string, entityId: string): Promise<TsEntry> {
  const r = await query(`SELECT * FROM ts_entries WHERE id = $1 AND user_id = $2 AND entity_id = $3`, [entryId, userId, entityId])
  const entry = r.rows[0]
  if (!entry) throw new Error('Entry not found')
  if (entry.status !== 'pending_approval') throw new Error('Can only approve pending entries')
  const updated = await query(
    `UPDATE ts_entries SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [entryId, approverUserId]
  )
  logAudit({ userId, entityId, actorUserId: approverUserId, action: 'entry.approved', targetType: 'entry', targetId: entryId })
  return updated.rows[0]
}

export async function rejectEntry(entryId: string, approverUserId: string, userId: string, entityId: string, reason: string): Promise<TsEntry> {
  const r = await query(`SELECT * FROM ts_entries WHERE id = $1 AND user_id = $2 AND entity_id = $3`, [entryId, userId, entityId])
  const entry = r.rows[0]
  if (!entry) throw new Error('Entry not found')
  if (entry.status !== 'pending_approval') throw new Error('Can only reject pending entries')
  const updated = await query(
    `UPDATE ts_entries SET status = 'rejected', rejection_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [entryId, reason]
  )
  logAudit({ userId, entityId, actorUserId: approverUserId, action: 'entry.rejected', targetType: 'entry', targetId: entryId })
  return updated.rows[0]
}

export async function bulkApprove(entryIds: string[], approverUserId: string, userId: string, entityId: string): Promise<{ approved: number; errors: string[] }> {
  let approved = 0
  const errors: string[] = []
  for (const id of entryIds) {
    try {
      await approveEntry(id, approverUserId, userId, entityId)
      approved++
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  return { approved, errors }
}

export async function bulkReject(entryIds: string[], approverUserId: string, userId: string, entityId: string, reason: string): Promise<{ rejected: number; errors: string[] }> {
  let rejected = 0
  const errors: string[] = []
  for (const id of entryIds) {
    try {
      await rejectEntry(id, approverUserId, userId, entityId, reason)
      rejected++
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  return { rejected, errors }
}

export async function lockEntry(entryId: string, userId: string, entityId: string): Promise<TsEntry> {
  const r = await query(`SELECT * FROM ts_entries WHERE id = $1 AND user_id = $2 AND entity_id = $3`, [entryId, userId, entityId])
  if (!r.rows[0]) throw new Error('Entry not found')
  if (r.rows[0].status !== 'approved') throw new Error('Can only lock approved entries')
  const updated = await query(
    `UPDATE ts_entries SET status = 'locked', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [entryId]
  )
  logAudit({ userId, entityId, actorUserId: userId, action: 'entry.locked', targetType: 'entry', targetId: entryId })
  return updated.rows[0]
}
