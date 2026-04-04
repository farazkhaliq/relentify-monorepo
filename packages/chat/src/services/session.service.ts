import type { Pool } from 'pg'
import type { ChatSession } from '../types'

export function createSessionService(pool: Pool) {
  return {
    async createSession(entityId: string, visitorId: string, data: { channel?: string; subject?: string; department?: string }): Promise<ChatSession> {
      const existing = await pool.query(
        `SELECT * FROM chat_sessions WHERE entity_id = $1 AND visitor_id = $2 AND status IN ('open','assigned','waiting') ORDER BY created_at DESC LIMIT 1`,
        [entityId, visitorId]
      )
      if (existing.rows[0]) return existing.rows[0]
      const result = await pool.query(
        `INSERT INTO chat_sessions (entity_id, visitor_id, channel, subject, department) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [entityId, visitorId, data.channel || 'widget', data.subject || null, data.department || null]
      )
      return result.rows[0]
    },

    async getSessionById(id: string): Promise<ChatSession | null> {
      const result = await pool.query('SELECT * FROM chat_sessions WHERE id = $1', [id])
      return result.rows[0] || null
    },

    async updateSession(id: string, data: { status?: string; assigned_agent_id?: string; department?: string; ai_enabled?: boolean }): Promise<ChatSession | null> {
      const sets: string[] = ['updated_at = NOW()']
      const params: any[] = []; let idx = 1
      if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status); if (data.status === 'resolved' || data.status === 'closed') sets.push('resolved_at = NOW()') }
      if (data.assigned_agent_id !== undefined) { sets.push(`assigned_agent_id = $${idx++}`); params.push(data.assigned_agent_id) }
      if (data.department !== undefined) { sets.push(`department = $${idx++}`); params.push(data.department) }
      if (data.ai_enabled !== undefined) { sets.push(`ai_enabled = $${idx++}`); params.push(data.ai_enabled) }
      params.push(id)
      const result = await pool.query(`UPDATE chat_sessions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params)
      return result.rows[0] || null
    },

    async listSessions(entityId: string, filters: { status?: string; search?: string; page?: number; limit?: number } = {}): Promise<{ sessions: ChatSession[]; total: number }> {
      const conds = ['s.entity_id = $1']; const params: any[] = [entityId]; let idx = 2
      if (filters.status) { conds.push(`s.status = $${idx++}`); params.push(filters.status) }
      if (filters.search) { conds.push(`(v.name ILIKE $${idx} OR v.email ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++ }
      const where = conds.join(' AND ')
      const limit = filters.limit || 50; const offset = ((filters.page || 1) - 1) * limit
      const [rows, count] = await Promise.all([
        pool.query(`SELECT s.*, v.name as visitor_name, v.email as visitor_email FROM chat_sessions s LEFT JOIN chat_visitors v ON v.id = s.visitor_id WHERE ${where} ORDER BY s.updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM chat_sessions s LEFT JOIN chat_visitors v ON v.id = s.visitor_id WHERE ${where}`, params),
      ])
      return { sessions: rows.rows, total: parseInt(count.rows[0].count, 10) }
    },
  }
}
