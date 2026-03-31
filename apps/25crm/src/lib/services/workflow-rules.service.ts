import pool from '../pool'

export interface WorkflowRule {
  id: string
  entity_id: string
  name: string
  trigger_type: string
  conditions: Record<string, any>
  actions: Record<string, any>
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export async function getAllWorkflowRules(entityId: string): Promise<WorkflowRule[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_workflow_rules WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  )
  return rows
}

export async function getWorkflowRuleById(id: string, entityId: string): Promise<WorkflowRule | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_workflow_rules WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createWorkflowRule(rule: Partial<WorkflowRule>): Promise<WorkflowRule> {
  const { entity_id, name, trigger_type, conditions, actions, is_active } = rule
  const { rows } = await pool.query(
    `INSERT INTO crm_workflow_rules (entity_id, name, trigger_type, conditions, actions, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [entity_id, name, trigger_type, JSON.stringify(conditions || {}), JSON.stringify(actions || {}), is_active ?? true]
  )
  return rows[0]
}

export async function updateWorkflowRule(id: string, entityId: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'created_at'].includes(k))
  if (fields.length === 0) return getWorkflowRuleById(id, entityId)
  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => {
    const val = (updates as any)[f]
    if (f === 'conditions' || f === 'actions') return JSON.stringify(val)
    return val
  })
  const { rows } = await pool.query(
    `UPDATE crm_workflow_rules SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteWorkflowRule(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_workflow_rules WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
