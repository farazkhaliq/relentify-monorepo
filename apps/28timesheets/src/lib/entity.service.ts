import { query } from './db'

export interface Entity {
  id: string
  user_id: string
  name: string
  is_default: boolean
}

export async function getActiveEntity(userId: string): Promise<Entity | null> {
  // Check active_entity_id first
  const userResult = await query(
    `SELECT active_entity_id FROM users WHERE id = $1`,
    [userId]
  )
  if (userResult.rows[0]?.active_entity_id) {
    const r = await query(
      `SELECT id, user_id, name, is_default FROM entities WHERE id = $1`,
      [userResult.rows[0].active_entity_id]
    )
    if (r.rows[0]) return r.rows[0]
  }

  // Fallback: default entity
  const r = await query(
    `SELECT id, user_id, name, is_default FROM entities WHERE user_id = $1 AND is_default = true LIMIT 1`,
    [userId]
  )
  if (r.rows[0]) return r.rows[0]

  // Fallback: any entity owned by user
  const any = await query(
    `SELECT id, user_id, name, is_default FROM entities WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  return any.rows[0] || null
}
