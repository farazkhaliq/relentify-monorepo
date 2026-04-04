import type { Pool } from 'pg'
import type { ChatMessage } from '../types'

export function createMessageService(pool: Pool) {
  return {
    async createMessage(data: {
      session_id: string; entity_id: string; sender_type: string;
      sender_id?: string; body: string; attachment_url?: string; metadata?: Record<string, any>
    }): Promise<ChatMessage> {
      const result = await pool.query(
        `INSERT INTO chat_messages (session_id, entity_id, sender_type, sender_id, body, attachment_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.session_id, data.entity_id, data.sender_type, data.sender_id || null,
         data.body, data.attachment_url || null, JSON.stringify(data.metadata || {})]
      )
      await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [data.session_id])
      return result.rows[0]
    },

    async getMessages(sessionId: string, since?: string): Promise<ChatMessage[]> {
      if (since) {
        const result = await pool.query('SELECT * FROM chat_messages WHERE session_id = $1 AND created_at > $2 ORDER BY created_at ASC', [sessionId, since])
        return result.rows
      }
      const result = await pool.query('SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC', [sessionId])
      return result.rows
    },
  }
}
