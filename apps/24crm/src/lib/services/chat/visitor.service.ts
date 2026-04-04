import pool from '../../pool'

export interface Visitor {
  id: string
  entity_id: string
  fingerprint: string
  name: string | null
  email: string | null
  ip_address: string | null
  user_agent: string | null
  page_url: string | null
  custom_data: Record<string, any>
  banned: boolean
  last_seen_at: string
  created_at: string
}

export async function getOrCreateVisitor(
  entityId: string,
  fingerprint: string,
  data: { name?: string; email?: string; ip_address?: string; user_agent?: string; page_url?: string }
): Promise<Visitor> {
  const result = await pool.query(
    `INSERT INTO chat_visitors (entity_id, fingerprint, name, email, ip_address, user_agent, page_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (entity_id, fingerprint) DO UPDATE SET
       last_seen_at = NOW(),
       page_url = COALESCE($7, chat_visitors.page_url),
       name = COALESCE($3, chat_visitors.name),
       email = COALESCE($4, chat_visitors.email),
       ip_address = COALESCE($5, chat_visitors.ip_address),
       user_agent = COALESCE($6, chat_visitors.user_agent)
     RETURNING *`,
    [entityId, fingerprint, data.name || null, data.email || null, data.ip_address || null, data.user_agent || null, data.page_url || null]
  )
  return result.rows[0]
}

export async function updateVisitor(
  id: string,
  data: { name?: string; email?: string; page_url?: string; custom_data?: Record<string, any> }
): Promise<Visitor | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.email !== undefined) { sets.push(`email = $${idx++}`); params.push(data.email) }
  if (data.page_url !== undefined) { sets.push(`page_url = $${idx++}`); params.push(data.page_url) }
  if (data.custom_data !== undefined) { sets.push(`custom_data = $${idx++}`); params.push(JSON.stringify(data.custom_data)) }
  sets.push(`last_seen_at = NOW()`)

  if (sets.length === 1) return getVisitorById(id)

  params.push(id)
  const result = await pool.query(
    `UPDATE chat_visitors SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function getVisitorById(id: string, entityId?: string): Promise<Visitor | null> {
  const q = entityId
    ? 'SELECT * FROM chat_visitors WHERE id = $1 AND entity_id = $2'
    : 'SELECT * FROM chat_visitors WHERE id = $1'
  const params = entityId ? [id, entityId] : [id]
  const result = await pool.query(q, params)
  return result.rows[0] || null
}

export async function banVisitor(id: string, entityId: string, banned = true): Promise<Visitor | null> {
  const result = await pool.query(
    'UPDATE chat_visitors SET banned = $1 WHERE id = $2 AND entity_id = $3 RETURNING *',
    [banned, id, entityId]
  )
  return result.rows[0] || null
}

export async function getLiveVisitors(entityId: string): Promise<Visitor[]> {
  const result = await pool.query(
    `SELECT * FROM chat_visitors
     WHERE entity_id = $1 AND last_seen_at > NOW() - INTERVAL '2 minutes' AND banned = FALSE
     ORDER BY last_seen_at DESC`,
    [entityId]
  )
  return result.rows
}
