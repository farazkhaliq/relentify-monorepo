import { createHash } from 'crypto'
import { query } from './db'

export async function verifyApiKey(authHeader: string | null): Promise<{ appId: string; keyId: string; userId: string | null } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)
  if (!key.startsWith('rs_live_')) return null

  const keyHash = createHash('sha256').update(key).digest('hex')

  const { rows } = await query(
    "SELECT id, app_id, user_id FROM esign_api_keys WHERE key_hash = $1 AND is_active = TRUE",
    [keyHash]
  )

  if (rows.length === 0) return null

  // Update last_used_at
  await query('UPDATE esign_api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id])

  return { appId: rows[0].app_id, keyId: rows[0].id, userId: rows[0].user_id || null }
}
