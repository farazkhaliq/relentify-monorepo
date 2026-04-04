import pool from '../pool'
import { sseManager } from './sse.service'

export interface Session {
  id: string
  entity_id: string
  visitor_id: string
  assigned_agent_id: string | null
  status: string
  channel: string
  subject: string | null
  department: string | null
  ai_enabled: boolean
  rating: number | null
  rating_comment: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface SessionFilters {
  status?: string
  department?: string
  search?: string
  page?: number
  limit?: number
}

export async function createSession(
  entityId: string,
  visitorId: string,
  data: { channel?: string; subject?: string; department?: string }
): Promise<Session> {
  // Check for existing open session for this visitor
  const existing = await pool.query(
    `SELECT * FROM chat_sessions
     WHERE entity_id = $1 AND visitor_id = $2 AND status IN ('open', 'assigned', 'waiting')
     ORDER BY created_at DESC LIMIT 1`,
    [entityId, visitorId]
  )
  if (existing.rows[0]) return existing.rows[0]

  const result = await pool.query(
    `INSERT INTO chat_sessions (entity_id, visitor_id, channel, subject, department)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [entityId, visitorId, data.channel || 'widget', data.subject || null, data.department || null]
  )

  const session = result.rows[0]
  // Broadcast new session to entity dashboard
  sseManager.broadcastEntity(entityId, 'new_session', session)

  // Auto-assign agent (async, don't block session creation)
  const { assignAgent } = await import('./routing.service')
  assignAgent(entityId, session.id).catch(err => console.error('Auto-assign error:', err))

  return session
}

export async function getSessionById(id: string): Promise<Session | null> {
  const result = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function updateSession(
  id: string,
  data: { status?: string; assigned_agent_id?: string; department?: string; ai_enabled?: boolean; subject?: string }
): Promise<Session | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`)
    params.push(data.status)
    if (data.status === 'resolved' || data.status === 'closed') {
      sets.push('resolved_at = NOW()')
    }
  }
  if (data.assigned_agent_id !== undefined) { sets.push(`assigned_agent_id = $${idx++}`); params.push(data.assigned_agent_id) }
  if (data.department !== undefined) { sets.push(`department = $${idx++}`); params.push(data.department) }
  if (data.ai_enabled !== undefined) { sets.push(`ai_enabled = $${idx++}`); params.push(data.ai_enabled) }
  if (data.subject !== undefined) { sets.push(`subject = $${idx++}`); params.push(data.subject) }

  params.push(id)
  const result = await pool.query(
    `UPDATE chat_sessions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  const session = result.rows[0] || null

  if (session) {
    // Broadcast session update to session listeners
    sseManager.broadcast(id, 'session_updated', session)

    // Broadcast entity-level events for dashboard
    if (data.status === 'resolved' || data.status === 'closed') {
      sseManager.broadcastEntity(session.entity_id, 'session_resolved', session)
    }
    if (data.assigned_agent_id) {
      sseManager.broadcastEntity(session.entity_id, 'session_assigned', session)
    }
  }

  return session
}

export async function listSessions(entityId: string, filters: SessionFilters = {}): Promise<{ sessions: Session[]; total: number }> {
  const conditions = ['s.entity_id = $1']
  const params: any[] = [entityId]
  let idx = 2

  if (filters.status) {
    conditions.push(`s.status = $${idx++}`)
    params.push(filters.status)
  }
  if (filters.department) {
    conditions.push(`s.department = $${idx++}`)
    params.push(filters.department)
  }
  if (filters.search) {
    conditions.push(`(v.name ILIKE $${idx} OR v.email ILIKE $${idx})`)
    params.push(`%${filters.search}%`)
    idx++
  }

  const where = conditions.join(' AND ')
  const limit = filters.limit || 50
  const offset = ((filters.page || 1) - 1) * limit

  const [rows, countResult] = await Promise.all([
    pool.query(
      `SELECT s.*, v.name as visitor_name, v.email as visitor_email, v.page_url as visitor_page_url
       FROM chat_sessions s
       LEFT JOIN chat_visitors v ON v.id = s.visitor_id
       WHERE ${where}
       ORDER BY s.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM chat_sessions s LEFT JOIN chat_visitors v ON v.id = s.visitor_id WHERE ${where}`, params),
  ])

  return { sessions: rows.rows, total: parseInt(countResult.rows[0].count, 10) }
}

export async function rateSession(id: string, rating: number, comment?: string): Promise<Session | null> {
  const result = await pool.query(
    'UPDATE chat_sessions SET rating = $1, rating_comment = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [rating, comment || null, id]
  )
  return result.rows[0] || null
}
