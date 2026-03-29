import { query } from './db'

export async function checkIdempotencyKey(
  key: string,
  entityId: string
): Promise<unknown | null> {
  const r = await query(
    `SELECT response FROM idempotency_keys
     WHERE key = $1 AND entity_id = $2
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [key, entityId]
  )
  return r.rows.length > 0 ? r.rows[0].response : null
}

export async function storeIdempotencyKey(
  key: string,
  entityId: string,
  response: unknown
): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (key, entity_id, response)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO NOTHING`,
    [key, entityId, JSON.stringify(response)]
  )
}

export async function cleanExpiredKeys(): Promise<number> {
  const r = await query(
    `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`
  )
  return r.rowCount ?? 0
}
