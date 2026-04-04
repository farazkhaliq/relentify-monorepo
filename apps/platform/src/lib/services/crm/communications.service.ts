import pool from '../../pool'

export interface Communication {
  id: string
  entity_id: string
  contact_id?: string
  user_id?: string
  type: 'Email' | 'Call' | 'WhatsApp' | 'SMS' | 'Note'
  direction?: 'Inbound' | 'Outbound'
  subject?: string
  body?: string
  status?: string
  related_property_id?: string
  related_tenancy_id?: string
  sent_at?: string
  created_at: Date
  updated_at: Date
  contact_name?: string
}

export async function getAllCommunications(
  entityId: string,
  type?: string
): Promise<Communication[]> {
  let sql = `
    SELECT c.*,
      CASE WHEN ct.id IS NOT NULL THEN ct.first_name || ' ' || ct.last_name ELSE NULL END AS contact_name
    FROM crm_communications c
    LEFT JOIN crm_contacts ct ON c.contact_id = ct.id
    WHERE c.entity_id = $1
  `
  const params: any[] = [entityId]

  if (type) {
    params.push(type)
    sql += ` AND c.type = $${params.length}`
  }

  sql += ' ORDER BY c.sent_at DESC'

  const { rows } = await pool.query(sql, params)
  return rows
}

export async function getCommunicationById(
  id: string,
  entityId: string
): Promise<Communication | null> {
  const { rows } = await pool.query(
    `SELECT c.*,
       CASE WHEN ct.id IS NOT NULL THEN ct.first_name || ' ' || ct.last_name ELSE NULL END AS contact_name
     FROM crm_communications c
     LEFT JOIN crm_contacts ct ON c.contact_id = ct.id
     WHERE c.id = $1 AND c.entity_id = $2`,
    [id, entityId]
  )
  return rows[0] || null
}

export async function createCommunication(
  comm: Partial<Communication>
): Promise<Communication> {
  const {
    entity_id, contact_id, user_id, type, direction,
    subject, body, status, related_property_id, related_tenancy_id,
    sent_at,
  } = comm

  const { rows } = await pool.query(
    `INSERT INTO crm_communications
       (entity_id, contact_id, user_id, type, direction, subject, body, status,
        related_property_id, related_tenancy_id, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      entity_id,
      contact_id || null,
      user_id || null,
      type,
      direction || null,
      subject || null,
      body || null,
      status || 'Received',
      related_property_id || null,
      related_tenancy_id || null,
      sent_at || new Date().toISOString(),
    ]
  )
  return rows[0]
}

export async function updateCommunication(
  id: string,
  entityId: string,
  updates: Partial<Communication>
): Promise<Communication | null> {
  const fields = Object.keys(updates).filter(
    k => !['id', 'entity_id', 'created_at', 'contact_name'].includes(k)
  )
  if (fields.length === 0) return getCommunicationById(id, entityId)

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])

  const { rows } = await pool.query(
    `UPDATE crm_communications SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteCommunication(
  id: string,
  entityId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_communications WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
