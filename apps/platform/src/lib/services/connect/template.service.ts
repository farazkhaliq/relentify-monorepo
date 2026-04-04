import pool from '../../pool'

export interface Template {
  id: string
  entity_id: string
  channel: string
  name: string
  body: string
  variables: any[]
  approved: boolean
  created_at: string
  updated_at: string
}

export async function listTemplates(entityId: string, channel?: string): Promise<Template[]> {
  if (channel) {
    const result = await pool.query(
      'SELECT * FROM connect_templates WHERE entity_id = $1 AND channel = $2 ORDER BY name',
      [entityId, channel]
    )
    return result.rows
  }
  const result = await pool.query('SELECT * FROM connect_templates WHERE entity_id = $1 ORDER BY channel, name', [entityId])
  return result.rows
}

export async function getTemplateById(id: string, entityId: string): Promise<Template | null> {
  const result = await pool.query('SELECT * FROM connect_templates WHERE id = $1 AND entity_id = $2', [id, entityId])
  return result.rows[0] || null
}

export async function createTemplate(entityId: string, data: { channel: string; name: string; body: string; variables?: any[] }): Promise<Template> {
  const result = await pool.query(
    `INSERT INTO connect_templates (entity_id, channel, name, body, variables)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [entityId, data.channel, data.name, data.body, JSON.stringify(data.variables || [])]
  )
  return result.rows[0]
}

export async function updateTemplate(id: string, entityId: string, data: Partial<Template>): Promise<Template | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.body !== undefined) { sets.push(`body = $${idx++}`); params.push(data.body) }
  if (data.variables !== undefined) { sets.push(`variables = $${idx++}`); params.push(JSON.stringify(data.variables)) }
  if (data.approved !== undefined) { sets.push(`approved = $${idx++}`); params.push(data.approved) }

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE connect_templates SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteTemplate(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM connect_templates WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}
