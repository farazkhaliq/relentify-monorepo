import pool from '../../pool'

export interface Document {
  id: string
  entity_id: string
  user_id?: string
  related_type: string
  related_id: string
  name: string
  file_path: string
  mime_type?: string
  size_bytes?: number
  description?: string
  tags: string[]
  created_at: Date
  updated_at: Date
}

export async function getAllDocuments(entityId: string): Promise<Document[]> {
  const { rows } = await pool.query(
    `SELECT * FROM crm_documents WHERE entity_id = $1 ORDER BY created_at DESC`,
    [entityId]
  )
  return rows
}

export async function getDocumentById(
  id: string,
  entityId: string
): Promise<Document | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_documents WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createDocument(
  doc: Partial<Document>
): Promise<Document> {
  const {
    entity_id, user_id, related_type, related_id, name,
    file_path, mime_type, size_bytes, description, tags,
  } = doc

  const { rows } = await pool.query(
    `INSERT INTO crm_documents
       (entity_id, user_id, related_type, related_id, name, file_path, mime_type, size_bytes, description, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      entity_id,
      user_id || null,
      related_type || 'general',
      related_id || entity_id,
      name,
      file_path,
      mime_type || null,
      size_bytes || null,
      description || null,
      tags || [],
    ]
  )
  return rows[0]
}

export async function updateDocument(
  id: string,
  entityId: string,
  updates: Partial<Document>
): Promise<Document | null> {
  const fields = Object.keys(updates).filter(
    k => !['id', 'entity_id', 'created_at'].includes(k)
  )
  if (fields.length === 0) return getDocumentById(id, entityId)

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])

  const { rows } = await pool.query(
    `UPDATE crm_documents SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteDocument(
  id: string,
  entityId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_documents WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
