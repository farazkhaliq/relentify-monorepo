import pool from '../../pool'

export async function incrementUsage(entityId: string, tokensIn: number, tokensOut: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  await pool.query(
    `INSERT INTO chat_ai_usage (entity_id, month, ai_replies, ai_tokens_in, ai_tokens_out)
     VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (entity_id, month) DO UPDATE SET
       ai_replies = chat_ai_usage.ai_replies + 1,
       ai_tokens_in = chat_ai_usage.ai_tokens_in + $3,
       ai_tokens_out = chat_ai_usage.ai_tokens_out + $4`,
    [entityId, month, tokensIn, tokensOut]
  )
}

export async function getUsage(entityId: string, month?: string): Promise<{
  ai_replies: number; ai_tokens_in: number; ai_tokens_out: number
} | null> {
  const m = month || new Date().toISOString().slice(0, 7)
  const result = await pool.query(
    'SELECT ai_replies, ai_tokens_in, ai_tokens_out FROM chat_ai_usage WHERE entity_id = $1 AND month = $2',
    [entityId, m]
  )
  return result.rows[0] || null
}
