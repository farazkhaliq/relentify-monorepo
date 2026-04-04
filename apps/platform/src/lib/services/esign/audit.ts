import { createHash } from 'crypto'
import { query } from './db'

interface AuditEntry {
  signingRequestId: string
  action: string
  ip?: string | null
  userAgent?: string | null
  details?: Record<string, unknown> | null
}

export async function appendAuditLog(entry: AuditEntry): Promise<void> {
  // Get the previous hash in the chain for this signing request
  const { rows: prev } = await query(
    'SELECT entry_hash FROM esign_audit_log WHERE signing_request_id = $1 ORDER BY created_at DESC LIMIT 1',
    [entry.signingRequestId]
  )
  const previousHash = prev.length > 0 ? prev[0].entry_hash : '0'.repeat(64)

  // Compute hash of this entry
  const now = new Date().toISOString()
  const hashInput = JSON.stringify({
    previous_hash: previousHash,
    action: entry.action,
    ip: entry.ip || null,
    timestamp: now,
    details: entry.details || null,
  })
  const entryHash = createHash('sha256').update(hashInput).digest('hex')

  await query(
    `INSERT INTO esign_audit_log (signing_request_id, action, ip, user_agent, details, entry_hash, previous_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.signingRequestId,
      entry.action,
      entry.ip || null,
      entry.userAgent || null,
      entry.details ? JSON.stringify(entry.details) : null,
      entryHash,
      previousHash,
      now,
    ]
  )
}
