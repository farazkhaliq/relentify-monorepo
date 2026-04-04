import pool from '../../pool'
import { getConfig } from './config.service'
import { updateSession } from './session.service'
import { createMessage } from './message.service'

interface Agent {
  id: string
  full_name: string
}

async function getAgentsForEntity(entityId: string): Promise<Agent[]> {
  const result = await pool.query(
    `SELECT u.id, u.full_name
     FROM users u
     JOIN entities e ON e.user_id = u.id
     WHERE e.id = $1
     UNION
     SELECT u.id, u.full_name
     FROM users u
     JOIN app_access aa ON aa.user_id = u.id
     WHERE aa.entity_id = $1`,
    [entityId]
  )
  return result.rows
}

async function getLeastBusyAgent(entityId: string, agents: Agent[]): Promise<Agent | null> {
  if (agents.length === 0) return null

  const agentIds = agents.map(a => a.id)
  const result = await pool.query(
    `SELECT assigned_agent_id, COUNT(*) as active_count
     FROM chat_sessions
     WHERE entity_id = $1
       AND assigned_agent_id = ANY($2)
       AND status IN ('open', 'assigned', 'waiting')
     GROUP BY assigned_agent_id`,
    [entityId, agentIds]
  )

  const counts = new Map<string, number>()
  for (const row of result.rows) {
    counts.set(row.assigned_agent_id, parseInt(row.active_count, 10))
  }

  // Find agent with lowest count (agents not in the map have 0)
  let minAgent = agents[0]
  let minCount = counts.get(agents[0].id) || 0

  for (const agent of agents) {
    const count = counts.get(agent.id) || 0
    if (count < minCount) {
      minAgent = agent
      minCount = count
    }
  }

  return minAgent
}

function getRoundRobinAgent(agents: Agent[], lastAssignedId: string | null): Agent | null {
  if (agents.length === 0) return null
  if (!lastAssignedId) return agents[0]

  const lastIdx = agents.findIndex(a => a.id === lastAssignedId)
  const nextIdx = (lastIdx + 1) % agents.length
  return agents[nextIdx]
}

export async function assignAgent(entityId: string, sessionId: string): Promise<string | null> {
  const config = await getConfig(entityId)
  if (!config || !config.auto_assign) return null

  const agents = await getAgentsForEntity(entityId)
  if (agents.length === 0) return null

  let selectedAgent: Agent | null = null

  if (config.routing_method === 'least-busy') {
    selectedAgent = await getLeastBusyAgent(entityId, agents)
  } else {
    // Default: round-robin
    selectedAgent = getRoundRobinAgent(agents, config.last_assigned_agent_id as string | null)
  }

  if (!selectedAgent) return null

  // Update session assignment
  await updateSession(sessionId, {
    assigned_agent_id: selectedAgent.id,
    status: 'assigned',
  })

  // Update last_assigned_agent_id for round-robin tracking
  await pool.query(
    'UPDATE chat_config SET last_assigned_agent_id = $1 WHERE entity_id = $2',
    [selectedAgent.id, entityId]
  )

  // Send system message
  await createMessage({
    session_id: sessionId,
    entity_id: entityId,
    sender_type: 'system',
    body: `${selectedAgent.full_name || 'An agent'} has joined the chat.`,
  })

  return selectedAgent.id
}
