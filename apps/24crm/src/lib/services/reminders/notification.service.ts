import pool from '../../pool';
import { v4 as uuidv4 } from 'uuid';

export async function scheduleNotification(taskId: string, userId: string, channel: 'email' | 'telegram', time: Date) {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO reminders_notifications (id, task_id, user_id, channel, scheduled_time)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, taskId, userId, channel, time]
  );
}

export async function getPendingNotifications() {
  const { rows } = await pool.query(
    `SELECT n.*, t.title as task_title, u.email as user_email, u.full_name as user_name
     FROM reminders_notifications n
     JOIN reminders_tasks t ON n.task_id = t.id
     JOIN users u ON n.user_id = u.id
     WHERE n.status = 'pending' AND n.scheduled_time <= NOW()`
  );
  return rows;
}

export async function markNotificationSent(id: string) {
  await pool.query("UPDATE reminders_notifications SET status = 'sent' WHERE id = $1", [id]);
}
