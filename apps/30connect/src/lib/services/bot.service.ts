import pool from '../pool'
import { createMessage } from './message.service'
import { updateConversation } from './conversation.service'

export interface Bot {
  id: string
  entity_id: string
  name: string
  description: string | null
  trigger_conditions: Record<string, any>
  flow: { nodes: BotNode[]; trigger?: { type: string; channels?: string[] } }
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface BotNode {
  id: string
  type: 'message' | 'buttons' | 'collect' | 'condition' | 'action' | 'ai_reply' | 'delay'
  text?: string
  next?: string
  options?: { label: string; next: string }[]
  field?: string
  prompt?: string
  action?: string
  condition?: { field: string; operator: string; value: any; then: string; else: string }
}

interface BotSession {
  id: string
  bot_id: string
  conversation_id: string
  current_node_id: string
  context: Record<string, any>
  status: string
}

// --- CRUD ---

export async function listBots(entityId: string): Promise<Bot[]> {
  const result = await pool.query('SELECT * FROM connect_bots WHERE entity_id = $1 ORDER BY name', [entityId])
  return result.rows
}

export async function getBotById(id: string, entityId: string): Promise<Bot | null> {
  const result = await pool.query('SELECT * FROM connect_bots WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createBot(entityId: string, data: Partial<Bot>): Promise<Bot> {
  const result = await pool.query(
    `INSERT INTO connect_bots (entity_id, name, description, trigger_conditions, flow, enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [entityId, data.name, data.description || null, JSON.stringify(data.trigger_conditions || {}),
     JSON.stringify(data.flow || { nodes: [] }), data.enabled ?? false]
  )
  return result.rows[0]
}

export async function updateBot(id: string, entityId: string, data: Partial<Bot>): Promise<Bot | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description) }
  if (data.trigger_conditions !== undefined) { sets.push(`trigger_conditions = $${idx++}`); params.push(JSON.stringify(data.trigger_conditions)) }
  if (data.flow !== undefined) { sets.push(`flow = $${idx++}`); params.push(JSON.stringify(data.flow)) }
  if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled) }

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE connect_bots SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteBot(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM connect_bots WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}

// --- Execution Engine ---

export async function findMatchingBot(entityId: string, channel: string): Promise<Bot | null> {
  const result = await pool.query(
    'SELECT * FROM connect_bots WHERE entity_id = $1 AND enabled = TRUE ORDER BY created_at ASC',
    [entityId]
  )

  for (const bot of result.rows) {
    const trigger = bot.flow?.trigger
    if (!trigger) continue
    if (trigger.type === 'new_conversation') {
      if (!trigger.channels || trigger.channels.includes(channel)) return bot
    }
  }
  return null
}

export async function startBotSession(bot: Bot, conversationId: string): Promise<BotSession> {
  const firstNode = bot.flow.nodes[0]
  if (!firstNode) throw new Error('Bot has no nodes')

  const result = await pool.query(
    `INSERT INTO connect_bot_sessions (entity_id, bot_id, conversation_id, current_node_id, context)
     VALUES ($1, $2, $3, $4, '{}') RETURNING *`,
    [bot.entity_id, bot.id, conversationId, firstNode.id]
  )

  const session = result.rows[0]
  await executeNode(bot, session, firstNode)
  return session
}

export async function processUserInput(conversationId: string, input: string): Promise<boolean> {
  const sessionResult = await pool.query(
    `SELECT bs.*, b.flow, b.entity_id FROM connect_bot_sessions bs
     JOIN connect_bots b ON b.id = bs.bot_id
     WHERE bs.conversation_id = $1 AND bs.status = 'active'
     ORDER BY bs.created_at DESC LIMIT 1`,
    [conversationId]
  )

  if (!sessionResult.rows[0]) return false

  const session = sessionResult.rows[0]
  const bot: Bot = { ...session, flow: session.flow }
  const currentNode = bot.flow.nodes.find(n => n.id === session.current_node_id)
  if (!currentNode) return false

  // Handle collect node — store input and advance
  if (currentNode.type === 'collect' && currentNode.field) {
    session.context[currentNode.field] = input
    await pool.query(
      'UPDATE connect_bot_sessions SET context = $1, current_node_id = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(session.context), currentNode.next || 'end', session.id]
    )
    const nextNode = bot.flow.nodes.find(n => n.id === currentNode.next)
    if (nextNode) await executeNode(bot, session, nextNode)
    return true
  }

  // Handle buttons — match input to option
  if (currentNode.type === 'buttons' && currentNode.options) {
    const match = currentNode.options.find(o => o.label.toLowerCase() === input.toLowerCase())
    if (match) {
      const nextNode = bot.flow.nodes.find(n => n.id === match.next)
      if (nextNode) {
        await pool.query(
          'UPDATE connect_bot_sessions SET current_node_id = $1, updated_at = NOW() WHERE id = $2',
          [nextNode.id, session.id]
        )
        await executeNode(bot, session, nextNode)
      }
      return true
    }
  }

  return false
}

async function executeNode(bot: Bot, session: BotSession, node: BotNode): Promise<void> {
  switch (node.type) {
    case 'message':
      await createMessage({
        conversation_id: session.conversation_id,
        entity_id: bot.entity_id,
        channel: 'web',
        sender_type: 'bot',
        body: node.text || '',
      })
      if (node.next) {
        const nextNode = bot.flow.nodes.find(n => n.id === node.next)
        if (nextNode) {
          await pool.query('UPDATE connect_bot_sessions SET current_node_id = $1 WHERE id = $2', [node.next, session.id])
          await executeNode(bot, session, nextNode)
        }
      } else {
        await pool.query('UPDATE connect_bot_sessions SET status = $1 WHERE id = $2', ['completed', session.id])
      }
      break

    case 'buttons':
      const buttonText = (node.text || '') + '\n' + (node.options || []).map((o, i) => `${i + 1}. ${o.label}`).join('\n')
      await createMessage({
        conversation_id: session.conversation_id,
        entity_id: bot.entity_id,
        channel: 'web',
        sender_type: 'bot',
        body: buttonText,
      })
      await pool.query('UPDATE connect_bot_sessions SET current_node_id = $1 WHERE id = $2', [node.id, session.id])
      break

    case 'collect':
      await createMessage({
        conversation_id: session.conversation_id,
        entity_id: bot.entity_id,
        channel: 'web',
        sender_type: 'bot',
        body: node.prompt || `Please provide your ${node.field}:`,
      })
      break

    case 'condition':
      if (node.condition) {
        const val = session.context[node.condition.field]
        const matches = val === node.condition.value
        const nextId = matches ? node.condition.then : node.condition.else
        const nextNode = bot.flow.nodes.find(n => n.id === nextId)
        if (nextNode) {
          await pool.query('UPDATE connect_bot_sessions SET current_node_id = $1 WHERE id = $2', [nextId, session.id])
          await executeNode(bot, session, nextNode)
        }
      }
      break

    case 'action':
      if (node.action === 'handoff_to_agent') {
        await pool.query('UPDATE connect_bot_sessions SET status = $1 WHERE id = $2', ['handed_off', session.id])
        await createMessage({
          conversation_id: session.conversation_id,
          entity_id: bot.entity_id,
          channel: 'web',
          sender_type: 'system',
          body: 'Connecting you with an agent...',
        })
        await updateConversation(session.conversation_id, { status: 'open' })
      } else if (node.action === 'create_ticket') {
        // TODO: integrate with ticket service
        await createMessage({
          conversation_id: session.conversation_id,
          entity_id: bot.entity_id,
          channel: 'web',
          sender_type: 'system',
          body: 'A support ticket has been created.',
        })
      }
      if (node.next) {
        const nextNode = bot.flow.nodes.find(n => n.id === node.next)
        if (nextNode) await executeNode(bot, session, nextNode)
      } else {
        await pool.query('UPDATE connect_bot_sessions SET status = $1 WHERE id = $2', ['completed', session.id])
      }
      break
  }
}

export async function testBot(bot: Bot, input: string[]): Promise<{ messages: string[]; context: Record<string, any> }> {
  const messages: string[] = []
  const context: Record<string, any> = {}
  const nodes = bot.flow.nodes
  if (nodes.length === 0) return { messages, context }

  let currentNode = nodes[0]
  let inputIdx = 0

  for (let i = 0; i < 50 && currentNode; i++) {
    if (currentNode.type === 'message') {
      messages.push(`[bot] ${currentNode.text}`)
      currentNode = nodes.find(n => n.id === currentNode!.next) as any
    } else if (currentNode.type === 'buttons') {
      messages.push(`[bot] ${currentNode.text}\n${currentNode.options?.map(o => `  • ${o.label}`).join('\n')}`)
      const userInput = input[inputIdx++] || currentNode.options?.[0]?.label || ''
      messages.push(`[user] ${userInput}`)
      const match = currentNode.options?.find(o => o.label.toLowerCase() === userInput.toLowerCase())
      currentNode = nodes.find(n => n.id === (match?.next || currentNode!.next)) as any
    } else if (currentNode.type === 'collect') {
      messages.push(`[bot] ${currentNode.prompt || `Enter ${currentNode.field}:`}`)
      const userInput = input[inputIdx++] || 'test@example.com'
      messages.push(`[user] ${userInput}`)
      if (currentNode.field) context[currentNode.field] = userInput
      currentNode = nodes.find(n => n.id === currentNode!.next) as any
    } else if (currentNode.type === 'action') {
      messages.push(`[action] ${currentNode.action}`)
      currentNode = currentNode.next ? nodes.find(n => n.id === currentNode!.next) as any : undefined as any
    } else {
      break
    }
  }

  return { messages, context }
}
