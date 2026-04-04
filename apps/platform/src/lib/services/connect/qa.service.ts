import pool from '../../pool'

export interface QAReview {
  id: string
  entity_id: string
  conversation_id: string
  reviewer_id: string
  agent_id: string | null
  scores: Record<string, number>
  ai_score: Record<string, any> | null
  notes: string | null
  coaching_notes: string | null
  created_at: string
}

export async function listReviews(entityId: string, agentId?: string): Promise<QAReview[]> {
  if (agentId) {
    const result = await pool.query(
      'SELECT * FROM connect_qa_reviews WHERE entity_id = $1 AND agent_id = $2 ORDER BY created_at DESC LIMIT 50',
      [entityId, agentId]
    )
    return result.rows
  }
  const result = await pool.query(
    'SELECT * FROM connect_qa_reviews WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 50',
    [entityId]
  )
  return result.rows
}

export async function getReviewById(id: string, entityId: string): Promise<QAReview | null> {
  const result = await pool.query('SELECT * FROM connect_qa_reviews WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createReview(entityId: string, data: {
  conversation_id: string; reviewer_id: string; agent_id?: string;
  scores: Record<string, number>; notes?: string; coaching_notes?: string
}): Promise<QAReview> {
  const result = await pool.query(
    `INSERT INTO connect_qa_reviews (entity_id, conversation_id, reviewer_id, agent_id, scores, notes, coaching_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [entityId, data.conversation_id, data.reviewer_id, data.agent_id || null,
     JSON.stringify(data.scores), data.notes || null, data.coaching_notes || null]
  )
  return result.rows[0]
}

export async function updateReview(id: string, entityId: string, data: Partial<QAReview>): Promise<QAReview | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.scores !== undefined) { sets.push(`scores = $${idx++}`); params.push(JSON.stringify(data.scores)) }
  if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(data.notes) }
  if (data.coaching_notes !== undefined) { sets.push(`coaching_notes = $${idx++}`); params.push(data.coaching_notes) }
  if (data.ai_score !== undefined) { sets.push(`ai_score = $${idx++}`); params.push(JSON.stringify(data.ai_score)) }

  if (sets.length === 0) return getReviewById(id, entityId)
  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE connect_qa_reviews SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}
