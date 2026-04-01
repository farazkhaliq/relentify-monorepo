import pool from '../pool'

export interface Notification {
  id: string
  entity_id: string
  user_id: string
  title: string
  message: string
  is_read: boolean
  link: string | null
  created_at: Date
}

export async function getNotifications(userId: string, entityId: string): Promise<Notification[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_notifications WHERE user_id = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 50',
    [userId, entityId]
  )
  return rows
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE crm_notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [id, userId]
  )
  return (rowCount ?? 0) > 0
}
