import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import pool from './pool'
import { v4 as uuidv4 } from 'uuid'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export interface ApiKeyEntity {
  id: string
  entity_id: string
  name: string
  scopes: string[]
}

export async function verifyApiKey(req: NextRequest): Promise<ApiKeyEntity | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)

  const hash = hashKey(key)
  const result = await pool.query(
    'SELECT id, entity_id, name, scopes FROM chat_api_keys WHERE key_hash = $1',
    [hash]
  )

  if (!result.rows[0]) return null

  // Update last_used_at
  pool.query('UPDATE chat_api_keys SET last_used_at = NOW() WHERE id = $1', [result.rows[0].id]).catch(() => {})

  return result.rows[0]
}

export async function createApiKey(entityId: string, name: string, scopes: string[] = ['read', 'write']): Promise<{ key: string; id: string }> {
  const rawKey = `rk_${uuidv4().replace(/-/g, '')}`
  const hash = hashKey(rawKey)
  const prefix = rawKey.slice(0, 10)

  const result = await pool.query(
    'INSERT INTO chat_api_keys (entity_id, name, key_hash, key_prefix, scopes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [entityId, name, hash, prefix, scopes]
  )

  return { key: rawKey, id: result.rows[0].id }
}

export async function listApiKeys(entityId: string) {
  const result = await pool.query(
    'SELECT id, name, key_prefix, scopes, last_used_at, created_at FROM chat_api_keys WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  )
  return result.rows
}

export async function deleteApiKey(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM chat_api_keys WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}
