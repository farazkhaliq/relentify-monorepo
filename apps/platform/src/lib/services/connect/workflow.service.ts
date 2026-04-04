import pool from '../../pool'
import { updateConversation } from './conversation.service'
import { createMessage } from './message.service'

export interface Workflow {
  id: string
  entity_id: string
  name: string
  trigger_event: string
  conditions: { field: string; operator: string; value: any }[]
  actions: { type: string; config: Record<string, any> }[]
  enabled: boolean
  created_at: string
  updated_at: string
}

// --- CRUD ---

export async function listWorkflows(entityId: string): Promise<Workflow[]> {
  const result = await pool.query('SELECT * FROM connect_workflows WHERE entity_id = $1 ORDER BY name', [entityId])
  return result.rows
}

export async function getWorkflowById(id: string, entityId: string): Promise<Workflow | null> {
  const result = await pool.query('SELECT * FROM connect_workflows WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createWorkflow(entityId: string, data: Partial<Workflow>): Promise<Workflow> {
  const result = await pool.query(
    `INSERT INTO connect_workflows (entity_id, name, trigger_event, conditions, actions, enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [entityId, data.name, data.trigger_event, JSON.stringify(data.conditions || []),
     JSON.stringify(data.actions || []), data.enabled ?? false]
  )
  return result.rows[0]
}

export async function updateWorkflow(id: string, entityId: string, data: Partial<Workflow>): Promise<Workflow | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.trigger_event !== undefined) { sets.push(`trigger_event = $${idx++}`); params.push(data.trigger_event) }
  if (data.conditions !== undefined) { sets.push(`conditions = $${idx++}`); params.push(JSON.stringify(data.conditions)) }
  if (data.actions !== undefined) { sets.push(`actions = $${idx++}`); params.push(JSON.stringify(data.actions)) }
  if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled) }

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE connect_workflows SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteWorkflow(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM connect_workflows WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}

// --- Execution Engine ---

function evaluateConditions(conditions: Workflow['conditions'], context: Record<string, any>): boolean {
  for (const cond of conditions) {
    const value = context[cond.field]
    switch (cond.operator) {
      case 'equals': if (value !== cond.value) return false; break
      case 'not_equals': if (value === cond.value) return false; break
      case 'contains': if (!String(value || '').includes(String(cond.value))) return false; break
      case 'starts_with': if (!String(value || '').startsWith(String(cond.value))) return false; break
      case 'in': if (!Array.isArray(cond.value) || !cond.value.includes(value)) return false; break
      default: break
    }
  }
  return true
}

async function executeActions(actions: Workflow['actions'], context: Record<string, any>, entityId: string, conversationId?: string): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'assign_agent':
        if (conversationId && action.config.agent_id) {
          await updateConversation(conversationId, { assigned_agent_id: action.config.agent_id, status: 'assigned' })
        }
        break
      case 'assign_department':
        if (conversationId && action.config.department) {
          await updateConversation(conversationId, { department: action.config.department })
        }
        break
      case 'send_message':
        if (conversationId && action.config.message) {
          await createMessage({ conversation_id: conversationId, entity_id: entityId, channel: context.channel || 'web', sender_type: 'system', body: action.config.message })
        }
        break
      case 'add_tag':
        if (conversationId && action.config.tag) {
          await pool.query(
            `UPDATE connect_conversations SET tags = array_append(tags, $1), updated_at = NOW() WHERE id = $2 AND NOT ($1 = ANY(tags))`,
            [action.config.tag, conversationId]
          )
        }
        break
      case 'set_priority':
        if (conversationId && action.config.priority) {
          await updateConversation(conversationId, { priority: action.config.priority } as any)
        }
        break
      case 'set_status':
        if (conversationId && action.config.status) {
          await updateConversation(conversationId, { status: action.config.status })
        }
        break
      case 'send_webhook':
        if (action.config.url) {
          fetch(action.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context),
          }).catch(() => {})
        }
        break
    }
  }
}

export async function triggerWorkflows(entityId: string, event: string, context: Record<string, any>, conversationId?: string): Promise<void> {
  const workflows = await pool.query(
    'SELECT * FROM connect_workflows WHERE entity_id = $1 AND trigger_event = $2 AND enabled = TRUE',
    [entityId, event]
  )

  for (const wf of workflows.rows) {
    const conditions = Array.isArray(wf.conditions) ? wf.conditions : []
    const actions = Array.isArray(wf.actions) ? wf.actions : []

    if (!evaluateConditions(conditions, context)) continue

    try {
      await executeActions(actions, context, entityId, conversationId)
      await pool.query(
        `INSERT INTO connect_workflow_runs (workflow_id, conversation_id, entity_id, status, result) VALUES ($1, $2, $3, 'completed', '{}')`,
        [wf.id, conversationId || null, entityId]
      )
    } catch (err: any) {
      await pool.query(
        `INSERT INTO connect_workflow_runs (workflow_id, conversation_id, entity_id, status, result) VALUES ($1, $2, $3, 'failed', $4)`,
        [wf.id, conversationId || null, entityId, JSON.stringify({ error: err.message })]
      )
    }
  }
}
