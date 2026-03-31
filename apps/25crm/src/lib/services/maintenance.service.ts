import pool from '../pool'

export interface MaintenanceRequest {
  id: string
  entity_id: string
  user_id: string
  property_id?: string
  title: string
  description?: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'New' | 'In Progress' | 'Awaiting Quote' | 'Scheduled' | 'Completed' | 'Cancelled'
  reported_by_id?: string
  assigned_to_id?: string
  created_at: Date
  updated_at: Date
  // Joined fields
  property_address?: string
}

export async function getAllMaintenanceRequests(entityId: string): Promise<MaintenanceRequest[]> {
  const { rows } = await pool.query(
    `SELECT m.*, p.address_line1 as property_address
     FROM crm_maintenance_requests m
     LEFT JOIN crm_properties p ON m.property_id = p.id
     WHERE m.entity_id = $1
     ORDER BY m.created_at DESC`,
    [entityId]
  )
  return rows
}

export async function getMaintenanceRequestById(id: string, entityId: string): Promise<MaintenanceRequest | null> {
  const { rows } = await pool.query(
    `SELECT m.*, p.address_line1 as property_address
     FROM crm_maintenance_requests m
     LEFT JOIN crm_properties p ON m.property_id = p.id
     WHERE m.id = $1 AND m.entity_id = $2`,
    [id, entityId]
  )
  return rows[0] || null
}

export async function createMaintenanceRequest(request: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
  const { entity_id, user_id, property_id, title, description, priority, status, reported_by_id, assigned_to_id } = request
  const { rows } = await pool.query(
    `INSERT INTO crm_maintenance_requests (entity_id, user_id, property_id, title, description, priority, status, reported_by_id, assigned_to_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [entity_id, user_id, property_id || null, title, description || null, priority || 'Medium', status || 'New', reported_by_id || null, assigned_to_id || null]
  )
  return rows[0]
}

export async function updateMaintenanceRequest(id: string, entityId: string, updates: Partial<MaintenanceRequest>): Promise<MaintenanceRequest | null> {
  const fields = Object.keys(updates).filter(k => !['id', 'entity_id', 'user_id', 'created_at', 'property_address'].includes(k))
  if (fields.length === 0) return getMaintenanceRequestById(id, entityId)
  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(', ')
  const values = fields.map(f => (updates as any)[f])
  const { rows } = await pool.query(
    `UPDATE crm_maintenance_requests SET ${setClause}, updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *`,
    [id, entityId, ...values]
  )
  return rows[0] || null
}

export async function deleteMaintenanceRequest(id: string, entityId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM crm_maintenance_requests WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (rowCount ?? 0) > 0
}
