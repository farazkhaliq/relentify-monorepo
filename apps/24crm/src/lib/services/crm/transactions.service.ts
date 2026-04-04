import pool from '../../pool'

export interface Transaction {
  id: string
  entity_id: string
  tenancy_id?: string
  contact_id?: string
  related_property_id?: string
  type: string
  amount: number
  currency: string
  status: string
  reconciled: boolean
  description?: string
  payer_contact_id?: string
  payee_contact_id?: string
  transaction_date: string
  created_at: Date
  updated_at: Date
  property_address?: string
  payer_name?: string
  payee_name?: string
  contact_name?: string
}

export async function getAllTransactions(
  entityId: string,
  type?: string,
  contactId?: string
): Promise<Transaction[]> {
  let sql = `
    SELECT t.*,
      p.address_line1 AS property_address,
      payer.first_name || ' ' || payer.last_name AS payer_name,
      payee.first_name || ' ' || payee.last_name AS payee_name,
      ct.first_name || ' ' || ct.last_name AS contact_name
    FROM crm_transactions t
    LEFT JOIN crm_properties p ON t.related_property_id = p.id
    LEFT JOIN crm_contacts payer ON t.payer_contact_id = payer.id
    LEFT JOIN crm_contacts payee ON t.payee_contact_id = payee.id
    LEFT JOIN crm_contacts ct ON t.contact_id = ct.id
    WHERE t.entity_id = $1
  `
  const params: any[] = [entityId]

  if (type) {
    params.push(type)
    sql += ` AND t.type = $${params.length}`
  }

  if (contactId) {
    params.push(contactId)
    sql += ` AND (t.contact_id = $${params.length} OR t.payer_contact_id = $${params.length} OR t.payee_contact_id = $${params.length})`
  }

  sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC'

  const { rows } = await pool.query(sql, params)
  return rows
}

export async function getTransactionById(
  id: string,
  entityId: string
): Promise<Transaction | null> {
  const { rows } = await pool.query(
    `SELECT t.*,
       p.address_line1 AS property_address,
       payer.first_name || ' ' || payer.last_name AS payer_name,
       payee.first_name || ' ' || payee.last_name AS payee_name,
       ct.first_name || ' ' || ct.last_name AS contact_name
     FROM crm_transactions t
     LEFT JOIN crm_properties p ON t.related_property_id = p.id
     LEFT JOIN crm_contacts payer ON t.payer_contact_id = payer.id
     LEFT JOIN crm_contacts payee ON t.payee_contact_id = payee.id
     LEFT JOIN crm_contacts ct ON t.contact_id = ct.id
     WHERE t.id = $1 AND t.entity_id = $2`,
    [id, entityId]
  )
  return rows[0] || null
}

export async function createTransaction(
  txn: Partial<Transaction>
): Promise<Transaction> {
  const {
    entity_id, tenancy_id, contact_id, related_property_id,
    type, amount, currency, status, reconciled, description,
    payer_contact_id, payee_contact_id, transaction_date,
  } = txn

  const { rows } = await pool.query(
    `INSERT INTO crm_transactions
       (entity_id, tenancy_id, contact_id, related_property_id,
        type, amount, currency, status, reconciled, description,
        payer_contact_id, payee_contact_id, transaction_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      entity_id,
      tenancy_id || null,
      contact_id || null,
      related_property_id || null,
      type,
      amount,
      currency || 'GBP',
      status || 'Pending',
      reconciled ?? false,
      description || null,
      payer_contact_id || null,
      payee_contact_id || null,
      transaction_date || new Date().toISOString(),
    ]
  )
  return rows[0]
}

export async function updateTransaction(
  id: string,
  entityId: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  const fields = Object.keys(updates).filter(
    k => !['id', 'entity_id', 'created_at', 'property_address', 'payer_name', 'payee_name', 'contact_name'].includes(k)
  )
  if (fields.length === 0) return getTransactionById(id, entityId)

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])

  const { rows } = await pool.query(
    `UPDATE crm_transactions SET ${setClause}, updated_at = NOW()
     WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteTransaction(
  id: string,
  entityId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_transactions WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
