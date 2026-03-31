import pool from '../pool'

export interface Contact {
  id: string
  entity_id: string
  user_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  contact_type: 'Lead' | 'Tenant' | 'Landlord' | 'Contractor' | 'Guarantor'
  status: 'Active' | 'Inactive' | 'Archived'
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  notes?: string
  created_at: Date
  updated_at: Date
}

export async function getAllContacts(entityId: string): Promise<Contact[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE entity_id = $1 ORDER BY last_name ASC, first_name ASC',
    [entityId]
  )
  return rows
}

export async function getContactById(id: string, entityId: string): Promise<Contact | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  const { entity_id, user_id, first_name, last_name, email, phone, contact_type, status, address_line1, address_line2, city, postcode, country, notes } = contact
  const { rows } = await pool.query(
    `INSERT INTO crm_contacts (entity_id, user_id, first_name, last_name, email, phone, contact_type, status, address_line1, address_line2, city, postcode, country, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [entity_id, user_id, first_name, last_name, email || null, phone || null, contact_type || 'Lead', status || 'Active', address_line1 || null, address_line2 || null, city || null, postcode || null, country || 'United Kingdom', notes || null]
  )
  return rows[0]
}

export async function updateContact(id: string, entityId: string, updates: Partial<Contact>): Promise<Contact | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'user_id', 'created_at'].includes(k))
  if (fields.length === 0) return getContactById(id, entityId)
  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])
  const { rows } = await pool.query(
    `UPDATE crm_contacts SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteContact(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_contacts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
