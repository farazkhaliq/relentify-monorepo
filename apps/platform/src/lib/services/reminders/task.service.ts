import pool from '../../pool';
import { v4 as uuidv4 } from 'uuid';

export interface Task {
  id: string;
  list_id: string;
  title: string;
  description?: string;
  owners: string[];
  heads_up: string[];
  parent_task_id?: string;
  due_date?: Date;
  start_date?: Date;
  completed_at?: Date;
  status: 'To Start' | 'In Progress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  recurring_rule?: any;
  custom_fields: any;
  notification_prefs: any;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  parent_title?: string;
}

export async function getTasks(listId: string, userId: string) {
  const sql = `
    SELECT t.*, p.title as parent_title
    FROM reminders_tasks t
    LEFT JOIN reminders_tasks p ON t.parent_task_id = p.id
    WHERE t.list_id = $1
    ORDER BY t.created_at DESC
  `;
  const { rows } = await pool.query(sql, [listId]);
  return rows as Task[];
}

export async function createTask(data: Partial<Task>, userId: string) {
  const id = uuidv4();
  const sql = `
    INSERT INTO reminders_tasks (
      id, list_id, title, description, owners, heads_up, parent_task_id,
      due_date, start_date, status, priority, recurring_rule,
      custom_fields, notification_prefs, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `;
  const params = [
    id, data.list_id, data.title, data.description, data.owners || [],
    data.heads_up || [], data.parent_task_id, data.due_date, data.start_date,
    data.status || 'To Start', data.priority || 'Normal', data.recurring_rule,
    data.custom_fields || {}, data.notification_prefs || {}, userId
  ];
  const { rows } = await pool.query(sql, params);
  
  if (data.parent_task_id) {
    await deriveParentTaskUpdates(data.parent_task_id);
  }
  
  return rows[0] as Task;
}

export async function updateTask(id: string, data: Partial<Task>) {
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at');
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const params = [id, ...fields.map(f => (data as any)[f])];
  
  const sql = `UPDATE reminders_tasks SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const { rows } = await pool.query(sql, params);
  const task = rows[0] as Task;

  if (task.parent_task_id) {
    await deriveParentTaskUpdates(task.parent_task_id);
  }
  
  return task;
}

export async function deriveParentTaskUpdates(parentId: string) {
  const { rows: subtasks } = await pool.query(
    'SELECT status, due_date FROM reminders_tasks WHERE parent_task_id = $1',
    [parentId]
  );
  
  if (subtasks.length === 0) return;

  let newStatus: Task['status'] = 'To Start';
  const allCompleted = subtasks.every(s => s.status === 'Completed' || s.status === 'Cancelled');
  const anyInProgress = subtasks.some(s => s.status === 'In Progress' || s.status === 'Completed');
  
  if (allCompleted) {
    newStatus = 'Completed';
  } else if (anyInProgress) {
    newStatus = 'In Progress';
  }

  const dueDates = subtasks.map(s => s.due_date).filter(Boolean).map(d => new Date(d).getTime());
  const maxDueDate = dueDates.length > 0 ? new Date(Math.max(...dueDates)) : null;

  await pool.query(
    'UPDATE reminders_tasks SET status = $1, due_date = $2, updated_at = NOW() WHERE id = $3',
    [newStatus, maxDueDate, parentId]
  );

  const { rows: parent } = await pool.query('SELECT parent_task_id FROM reminders_tasks WHERE id = $1', [parentId]);
  if (parent[0]?.parent_task_id) {
    await deriveParentTaskUpdates(parent[0].parent_task_id);
  }
}
