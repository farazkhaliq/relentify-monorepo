import pool from '../../pool'
import { sseManager } from './sse.service'

export interface ConnectMessage {
  id: string
  conversation_id: string
  entity_id: string
  channel: string
  sender_type: string
  sender_id: string | null
  body: string
  attachment_url: string | null
  external_message_id: string | null
  metadata: Record<string, any>
  created_at: string
}

export async function createMessage(data: {
  conversation_id: string; entity_id: string; channel: string;
  sender_type: string; sender_id?: string; body: string;
  attachment_url?: string; external_message_id?: string; metadata?: Record<string, any>
}): Promise<ConnectMessage> {
  const result = await pool.query(
    `INSERT INTO connect_messages (conversation_id, entity_id, channel, sender_type, sender_id, body, attachment_url, external_message_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.conversation_id, data.entity_id, data.channel, data.sender_type,
     data.sender_id || null, data.body, data.attachment_url || null,
     data.external_message_id || null, JSON.stringify(data.metadata || {})]
  )

  await pool.query('UPDATE connect_conversations SET updated_at = NOW() WHERE id = $1', [data.conversation_id])

  const msg = result.rows[0]
  if (data.sender_type !== 'note') {
    sseManager.broadcast(data.conversation_id, 'new_message', msg)
  }

  return msg
}

export async function getMessages(conversationId: string, since?: string): Promise<ConnectMessage[]> {
  if (since) {
    const result = await pool.query(
      'SELECT * FROM connect_messages WHERE conversation_id = $1 AND created_at > $2 ORDER BY created_at ASC',
      [conversationId, since]
    )
    return result.rows
  }
  const result = await pool.query(
    'SELECT * FROM connect_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  )
  return result.rows
}
