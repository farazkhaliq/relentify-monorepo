import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function logAudit(
  workspaceId: string,
  userId: string,
  action: string,
  taskId?: string,
  oldValue?: any,
  newValue?: any
) {
  const id = uuidv4();
  await query(
    `INSERT INTO reminders_audit_log (id, workspace_id, user_id, action, task_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, workspaceId, userId, action, taskId, oldValue, newValue]
  );
}

export async function getAuditLogs(workspaceId: string, limit = 100) {
  const { rows } = await query(
    `SELECT a.*, u.full_name as user_name, t.title as task_title
     FROM reminders_audit_log a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN reminders_tasks t ON a.task_id = t.id
     WHERE a.workspace_id = $1
     ORDER BY a.timestamp DESC
     LIMIT $2`,
    [workspaceId, limit]
  );
  return rows;
}

export async function undoLastAction(userId: string) {
  const { rows } = await query(
    'SELECT * FROM reminders_audit_log WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1',
    [userId]
  );
  
  if (rows.length === 0) return null;
  const lastAction = rows[0];

  if (lastAction.action === 'update' && lastAction.task_id) {
    const fields = Object.keys(lastAction.old_value);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const params = [lastAction.task_id, ...fields.map(f => lastAction.old_value[f])];
    
    await query(`UPDATE reminders_tasks SET ${setClause} WHERE id = $1`, params);
    await query('DELETE FROM reminders_audit_log WHERE id = $1', [lastAction.id]);
    return true;
  }
  
  return false;
}
