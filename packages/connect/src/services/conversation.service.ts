import type { Pool } from 'pg'

export interface Conversation {
  id: string; entity_id: string; channel: string; external_id: string | null
  contact_name: string | null; contact_email: string | null; contact_phone: string | null
  assigned_agent_id: string | null; status: string; priority: string; department: string | null
  subject: string | null; tags: string[]; chat_session_id: string | null
  metadata: Record<string, any>; created_at: string; updated_at: string; resolved_at: string | null
}

export function createConversationService(pool: Pool) {
  return {
    async createConversation(entityId: string, data: {
      channel: string; external_id?: string; contact_name?: string; contact_email?: string;
      contact_phone?: string; subject?: string; department?: string; chat_session_id?: string
    }): Promise<Conversation> {
      if (data.external_id) {
        const existing = await pool.query(
          `SELECT * FROM connect_conversations WHERE entity_id = $1 AND external_id = $2 AND channel = $3 AND status IN ('open','assigned','waiting') ORDER BY created_at DESC LIMIT 1`,
          [entityId, data.external_id, data.channel]
        )
        if (existing.rows[0]) return existing.rows[0]
      }
      const result = await pool.query(
        `INSERT INTO connect_conversations (entity_id, channel, external_id, contact_name, contact_email, contact_phone, subject, department, chat_session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [entityId, data.channel, data.external_id || null, data.contact_name || null, data.contact_email || null, data.contact_phone || null, data.subject || null, data.department || null, data.chat_session_id || null]
      )
      return result.rows[0]
    },

    async getConversationById(id: string): Promise<Conversation | null> {
      const result = await pool.query('SELECT * FROM connect_conversations WHERE id = $1', [id])
      return result.rows[0] || null
    },

    async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | null> {
      const sets: string[] = ['updated_at = NOW()']; const params: any[] = []; let idx = 1
      const fields = ['status','priority','department','assigned_agent_id','subject','contact_name','contact_email','contact_phone'] as const
      for (const f of fields) { if (data[f] !== undefined) { sets.push(`${f} = $${idx++}`); params.push(data[f]) } }
      if (data.tags !== undefined) { sets.push(`tags = $${idx++}`); params.push(data.tags) }
      if (data.status === 'resolved' || data.status === 'closed') sets.push('resolved_at = NOW()')
      params.push(id)
      const result = await pool.query(`UPDATE connect_conversations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params)
      return result.rows[0] || null
    },

    async listConversations(entityId: string, filters: { channel?: string; status?: string; search?: string; page?: number; limit?: number } = {}): Promise<{ conversations: Conversation[]; total: number }> {
      const conds = ['entity_id = $1']; const params: any[] = [entityId]; let idx = 2
      if (filters.channel) { conds.push(`channel = $${idx++}`); params.push(filters.channel) }
      if (filters.status) { conds.push(`status = $${idx++}`); params.push(filters.status) }
      if (filters.search) { conds.push(`(contact_name ILIKE $${idx} OR contact_email ILIKE $${idx} OR subject ILIKE $${idx})`); params.push(`%${filters.search}%`); idx++ }
      const where = conds.join(' AND '); const limit = filters.limit || 50; const offset = ((filters.page || 1) - 1) * limit
      const [rows, count] = await Promise.all([
        pool.query(`SELECT * FROM connect_conversations WHERE ${where} ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`, [...params, limit, offset]),
        pool.query(`SELECT COUNT(*) FROM connect_conversations WHERE ${where}`, params),
      ])
      return { conversations: rows.rows, total: parseInt(count.rows[0].count, 10) }
    },
  }
}
