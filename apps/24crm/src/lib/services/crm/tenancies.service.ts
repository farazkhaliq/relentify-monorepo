import pool from '../../pool'

export interface Tenancy {
  id: string
  entity_id: string
  user_id: string
  property_id: string
  start_date: Date
  end_date?: Date
  rent_amount: number
  deposit_amount?: number
  status: 'Active' | 'Ended' | 'Arrears' | 'Pending' | 'Draft'
  pipeline_status?: string
  payment_frequency?: string
  created_at: Date
  updated_at: Date
  // Joined fields
  property_address?: string
  tenant_names?: string[]
  tenant_ids?: string[]
}

export async function getAllTenancies(entityId: string): Promise<Tenancy[]> {
  const { rows } = await pool.query(
    `SELECT t.*, p.address_line1 as property_address,
     ARRAY(SELECT c.first_name || ' ' || c.last_name
           FROM crm_tenancy_tenants tt
           JOIN crm_contacts c ON tt.contact_id = c.id
           WHERE tt.tenancy_id = t.id) as tenant_names,
     ARRAY(SELECT tt.contact_id::text FROM crm_tenancy_tenants tt WHERE tt.tenancy_id = t.id) as tenant_ids
     FROM crm_tenancies t
     LEFT JOIN crm_properties p ON t.property_id = p.id
     WHERE t.entity_id = $1
     ORDER BY t.start_date DESC`,
    [entityId]
  )
  return rows
}

export async function getTenancyById(id: string, entityId: string): Promise<Tenancy | null> {
  const { rows } = await pool.query(
    `SELECT t.*, p.address_line1 as property_address,
     ARRAY(SELECT c.first_name || ' ' || c.last_name
           FROM crm_tenancy_tenants tt
           JOIN crm_contacts c ON tt.contact_id = c.id
           WHERE tt.tenancy_id = t.id) as tenant_names,
     ARRAY(SELECT tt.contact_id::text FROM crm_tenancy_tenants tt WHERE tt.tenancy_id = t.id) as tenant_ids
     FROM crm_tenancies t
     LEFT JOIN crm_properties p ON t.property_id = p.id
     WHERE t.id = $1 AND t.entity_id = $2`,
    [id, entityId]
  )
  return rows[0] || null
}

export async function createTenancy(tenancy: Partial<Tenancy> & { tenant_ids?: string[] }): Promise<Tenancy> {
  const { entity_id, user_id, property_id, rent_amount, deposit_amount, start_date, end_date, status, pipeline_status, payment_frequency, tenant_ids } = tenancy

  const { rows } = await pool.query(
    `INSERT INTO crm_tenancies (entity_id, user_id, property_id, rent_amount, deposit_amount, start_date, end_date, status, pipeline_status, payment_frequency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [entity_id, user_id, property_id, rent_amount || 0, deposit_amount || null, start_date, end_date || null, status || 'Pending', pipeline_status || 'Application Received', payment_frequency || 'Monthly']
  )
  const created = rows[0]

  // Insert tenant links
  if (tenant_ids && tenant_ids.length > 0) {
    const values = tenant_ids.map((_, i) => `($1, $${i + 2})`).join(', ')
    await pool.query(
      `INSERT INTO crm_tenancy_tenants (tenancy_id, contact_id) VALUES ${values}`,
      [created.id, ...tenant_ids]
    )
  }

  return getTenancyById(created.id, entity_id!) as Promise<Tenancy>
}

export async function updateTenancy(id: string, entityId: string, updates: Partial<Tenancy> & { tenant_ids?: string[] }): Promise<Tenancy | null> {
  const { tenant_ids, ...rest } = updates
  const fields = Object.keys(rest).filter(k => !['id', 'entity_id', 'user_id', 'created_at', 'property_address', 'tenant_names'].includes(k))

  if (fields.length > 0) {
    const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
    const values = fields.map(f => (rest as any)[f])
    await pool.query(
      `UPDATE crm_tenancies SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2`,
      [id, entityId, ...values]
    )
  }

  // Update tenant links if provided
  if (tenant_ids !== undefined) {
    await pool.query('DELETE FROM crm_tenancy_tenants WHERE tenancy_id = $1', [id])
    if (tenant_ids.length > 0) {
      const values = tenant_ids.map((_, i) => `($1, $${i + 2})`).join(', ')
      await pool.query(
        `INSERT INTO crm_tenancy_tenants (tenancy_id, contact_id) VALUES ${values}`,
        [id, ...tenant_ids]
      )
    }
  }

  return getTenancyById(id, entityId)
}

export async function deleteTenancy(id: string, entityId: string): Promise<boolean> {
  // Delete tenant links first (no CASCADE)
  await pool.query('DELETE FROM crm_tenancy_tenants WHERE tenancy_id = $1', [id])
  const { rowCount } = await pool.query(
    'DELETE FROM crm_tenancies WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
