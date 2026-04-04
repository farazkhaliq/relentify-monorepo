import { query } from './db'

export interface TsComment {
  id: string; entry_id: string; feed_event_type: string
  author_user_id: string; body: string; created_at: string
  author_name?: string
}

export async function createComment(data: {
  userId: string; entityId: string; entryId: string
  feedEventType: string; authorUserId: string; body: string
}): Promise<TsComment> {
  const r = await query(
    `INSERT INTO ts_comments (user_id, entity_id, entry_id, feed_event_type, author_user_id, body)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.userId, data.entityId, data.entryId, data.feedEventType, data.authorUserId, data.body]
  )
  return r.rows[0]
}

export async function getComments(entryId: string, feedEventType?: string): Promise<TsComment[]> {
  const conditions = ['c.entry_id = $1']
  const params: unknown[] = [entryId]
  if (feedEventType) {
    conditions.push('c.feed_event_type = $2')
    params.push(feedEventType)
  }
  const r = await query(
    `SELECT c.*, u.full_name as author_name FROM ts_comments c JOIN users u ON c.author_user_id = u.id
     WHERE ${conditions.join(' AND ')} ORDER BY c.created_at ASC`,
    params
  )
  return r.rows
}
