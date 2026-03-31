import pool from '../pool'

export interface BankAccount {
  id: string
  entity_id: string
  account_name: string
  sort_code?: string
  account_number?: string
  bank_name?: string
  is_default: boolean
  created_at: Date
  updated_at: Date
}

export async function getAllBankAccounts(entityId: string): Promise<BankAccount[]> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_bank_accounts WHERE entity_id = $1 ORDER BY created_at DESC',
    [entityId]
  )
  return rows
}

export async function getBankAccountById(id: string, entityId: string): Promise<BankAccount | null> {
  const { rows } = await pool.query(
    'SELECT * FROM crm_bank_accounts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return rows[0] || null
}

export async function createBankAccount(account: Partial<BankAccount>): Promise<BankAccount> {
  const { entity_id, account_name, sort_code, account_number, bank_name, is_default } = account
  const { rows } = await pool.query(
    `INSERT INTO crm_bank_accounts (entity_id, account_name, sort_code, account_number, bank_name, is_default)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [entity_id, account_name, sort_code || null, account_number || null, bank_name || null, is_default ?? false]
  )
  return rows[0]
}

export async function updateBankAccount(id: string, entityId: string, updates: Partial<BankAccount>): Promise<BankAccount | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'created_at'].includes(k))
  if (fields.length === 0) return getBankAccountById(id, entityId)
  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])
  const { rows } = await pool.query(
    `UPDATE crm_bank_accounts SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteBankAccount(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_bank_accounts WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
