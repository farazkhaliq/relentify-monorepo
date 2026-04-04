import pool from '../../pool'

export interface Task {
  id: string
  entity_id: string
  user_id: string
  title: string
  description?: string
  due_date?: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'To Do' | 'In Progress' | 'Completed'
  related_type?: string
  related_id?: string
  created_at: Date
  updated_at: Date
}

export async function getAllTasks(entityId: string): Promise<Task[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_tasks WHERE entity_id = $1 ORDER BY due_date ASC',
    [entityId]
  )
  return rows
}

export async function getTaskById(id: string, entityId: string): Promise<Task | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_tasks WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  const { entity_id, user_id, title, description, due_date, priority, status, related_type, related_id } = task
  const { rows } = await pool.query(
    `INSERT INTO crm_tasks (entity_id, user_id, title, description, due_date, priority, status, related_type, related_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [entity_id, user_id, title, description || null, due_date || null, priority || 'Medium', status || 'To Do', related_type || null, related_id || null]
  )
  return rows[0]
}

export async function updateTask(id: string, entityId: string, updates: Partial<Task>): Promise<Task | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'user_id', 'created_at'].includes(k))
  if (fields.length === 0) return getTaskById(id, entityId)
  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])
  const { rows } = await pool.query(
    `UPDATE crm_tasks SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteTask(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_tasks WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
