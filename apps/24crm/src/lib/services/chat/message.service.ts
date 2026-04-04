import pool from '../../pool'
import { sseManager } from './sse.service'

export interface Message {
  id: string
  session_id: string
  entity_id: string
  sender_type: 'visitor' | 'agent' | 'ai' | 'system' | 'note'
  sender_id: string | null
  body: string
  attachment_url: string | null
  metadata: Record<string, any>
  created_at: string
}

export async function createMessage(data: {
  session_id: string
  entity_id: string
  sender_type: string
  sender_id?: string
  body: string
  attachment_url?: string
  metadata?: Record<string, any>
}): Promise<Message> {
  const result = await pool.query(
    `INSERT INTO chat_messages (session_id, entity_id, sender_type, sender_id, body, attachment_url, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      data.session_id,
      data.entity_id,
      data.sender_type,
      data.sender_id || null,
      data.body,
      data.attachment_url || null,
      JSON.stringify(data.metadata || {}),
    ]
  )

  // Update session updated_at
  await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [data.session_id])

  const message = result.rows[0]

  // Broadcast via SSE (skip internal notes — not visible to widget)
  if (data.sender_type !== 'note') {
    sseManager.broadcast(data.session_id, 'new_message', message)
  }

  return message
}

export async function getMessages(sessionId: string, since?: string): Promise<Message[]> {
  if (since) {
    const result = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 AND created_at > $2 ORDER BY created_at ASC',
      [sessionId, since]
    )
    return result.rows
  }
  const result = await pool.query(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  )
  return result.rows
}
