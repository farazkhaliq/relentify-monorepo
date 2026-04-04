import pool from '../../pool'
import { sseManager } from './sse.service'

export interface Trigger {
  id: string
  entity_id: string
  name: string
  conditions: {
    time_on_page?: number
    page_url?: string
    visit_count?: number
    referrer?: string
  }
  action: {
    type: 'send_message' | 'open_widget'
    message?: string
  }
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VisitorContext {
  time_on_page: number
  page_url: string
  visit_count: number
  referrer: string
}

export async function listTriggers(entityId: string): Promise<Trigger[]> {
  const result = await pool.query(
    'SELECT * FROM chat_triggers WHERE entity_id = $1 ORDER BY sort_order ASC',
    [entityId]
  )
  return result.rows
}

export async function getTriggerById(id: string, entityId: string): Promise<Trigger | null> {
  const result = await pool.query('SELECT * FROM chat_triggers WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createTrigger(entityId: string, data: Partial<Trigger>): Promise<Trigger> {
  const result = await pool.query(
    `INSERT INTO chat_triggers (entity_id, name, conditions, action, enabled, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [entityId, data.name, JSON.stringify(data.conditions || {}), JSON.stringify(data.action || {}), data.enabled ?? true, data.sort_order ?? 0]
  )
  return result.rows[0]
}

export async function updateTrigger(id: string, entityId: string, data: Partial<Trigger>): Promise<Trigger | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.conditions !== undefined) { sets.push(`conditions = $${idx++}`); params.push(JSON.stringify(data.conditions)) }
  if (data.action !== undefined) { sets.push(`action = $${idx++}`); params.push(JSON.stringify(data.action)) }
  if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled) }
  if (data.sort_order !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(data.sort_order) }

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE chat_triggers SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteTrigger(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM chat_triggers WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}

function matchesCondition(condition: Trigger['conditions'], ctx: VisitorContext): boolean {
  if (condition.time_on_page !== undefined && ctx.time_on_page < condition.time_on_page) return false
  if (condition.page_url && !ctx.page_url.includes(condition.page_url)) return false
  if (condition.visit_count !== undefined && ctx.visit_count < condition.visit_count) return false
  if (condition.referrer && !ctx.referrer.includes(condition.referrer)) return false
  return true
}

export async function evaluateTriggers(
  entityId: string,
  sessionId: string,
  ctx: VisitorContext
): Promise<{ type: string; message?: string }[]> {
  const triggers = await pool.query(
    'SELECT * FROM chat_triggers WHERE entity_id = $1 AND enabled = TRUE ORDER BY sort_order ASC',
    [entityId]
  )

  // Get already-fired triggers for this session
  const sessionResult = await pool.query('SELECT metadata FROM chat_sessions WHERE id = $1', [sessionId])
  const metadata = sessionResult.rows[0]?.metadata || {}
  const firedTriggers: string[] = metadata.fired_triggers || []

  const actions: { type: string; message?: string }[] = []

  for (const trigger of triggers.rows) {
    if (firedTriggers.includes(trigger.id)) continue
    if (!matchesCondition(trigger.conditions, ctx)) continue

    const action = trigger.action
    actions.push(action)
    firedTriggers.push(trigger.id)

    // Execute action
    if (action.type === 'send_message' && action.message) {
      // Create system message
      const { createMessage } = await import('./message.service')
      await createMessage({
        session_id: sessionId,
        entity_id: entityId,
        sender_type: 'system',
        body: action.message,
      })
    } else if (action.type === 'open_widget') {
      sseManager.broadcast(sessionId, 'trigger_action', { type: 'open_widget' })
    }
  }

  // Update fired_triggers in session metadata
  if (actions.length > 0) {
    await pool.query(
      `UPDATE chat_sessions SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{fired_triggers}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(firedTriggers), sessionId]
    )
  }

  return actions
}
