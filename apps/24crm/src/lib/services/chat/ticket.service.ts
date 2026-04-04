import pool from '../../pool'

export interface Ticket {
  id: string
  entity_id: string
  visitor_id: string | null
  session_id: string | null
  subject: string
  status: string
  priority: string
  department: string | null
  assigned_agent_id: string | null
  custom_fields: Record<string, any>
  tags: string[]
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface TicketFilters {
  status?: string
  priority?: string
  department?: string
  page?: number
  limit?: number
}

export async function listTickets(entityId: string, filters: TicketFilters = {}): Promise<{ tickets: Ticket[]; total: number }> {
  const conditions = ['entity_id = $1']
  const params: any[] = [entityId]
  let idx = 2

  if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status) }
  if (filters.priority) { conditions.push(`priority = $${idx++}`); params.push(filters.priority) }
  if (filters.department) { conditions.push(`department = $${idx++}`); params.push(filters.department) }

  const where = conditions.join(' AND ')
  const limit = filters.limit || 50
  const offset = ((filters.page || 1) - 1) * limit

  const [rows, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM chat_tickets WHERE ${where} ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM chat_tickets WHERE ${where}`, params),
  ])

  return { tickets: rows.rows, total: parseInt(countResult.rows[0].count, 10) }
}

export async function getTicketById(id: string, entityId: string): Promise<Ticket | null> {
  const result = await pool.query('SELECT * FROM chat_tickets WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createTicket(entityId: string, data: {
  subject: string; visitor_id?: string; session_id?: string; priority?: string; department?: string;
  assigned_agent_id?: string; custom_fields?: Record<string, any>; tags?: string[]
}): Promise<Ticket> {
  const result = await pool.query(
    `INSERT INTO chat_tickets (entity_id, visitor_id, session_id, subject, priority, department, assigned_agent_id, custom_fields, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [entityId, data.visitor_id || null, data.session_id || null, data.subject,
     data.priority || 'medium', data.department || null, data.assigned_agent_id || null,
     JSON.stringify(data.custom_fields || {}), data.tags || []]
  )
  return result.rows[0]
}

export async function updateTicket(id: string, entityId: string, data: Partial<Ticket>): Promise<Ticket | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  const fields = ['subject', 'status', 'priority', 'department', 'assigned_agent_id'] as const
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f} = $${idx++}`); params.push(data[f]) }
  }
  if (data.custom_fields !== undefined) { sets.push(`custom_fields = $${idx++}`); params.push(JSON.stringify(data.custom_fields)) }
  if (data.tags !== undefined) { sets.push(`tags = $${idx++}`); params.push(data.tags) }
  if (data.status === 'resolved' || data.status === 'closed') sets.push('resolved_at = NOW()')

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE chat_tickets SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteTicket(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM chat_tickets WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}

export async function mergeTickets(sourceId: string, targetId: string, entityId: string): Promise<Ticket | null> {
  const source = await getTicketById(sourceId, entityId)
  const target = await getTicketById(targetId, entityId)
  if (!source || !target) return null

  // Move messages from source session to target session (if both have sessions)
  if (source.session_id && target.session_id) {
    await pool.query(
      'UPDATE chat_messages SET session_id = $1 WHERE session_id = $2',
      [target.session_id, source.session_id]
    )
  }

  // Close source ticket
  await pool.query(
    `UPDATE chat_tickets SET status = 'closed', updated_at = NOW(), resolved_at = NOW() WHERE id = $1`,
    [sourceId]
  )

  return target
}
