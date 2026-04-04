import pool from '../../pool'

export interface UserProfile {
  id: string
  entity_id: string
  user_id: string
  role: 'Admin' | 'Staff'
  permissions: Record<string, any>
  created_at: Date
  updated_at: Date
  email?: string
  full_name?: string
}

export async function getUserProfiles(entityId: string): Promise<UserProfile[]> {
  const { rows } = await pool.query(
    `SELECT p.*, u.email, u.full_name FROM crm_user_profiles p
     JOIN users u ON p.user_id = u.id
     WHERE p.entity_id = $1 ORDER BY u.full_name`,
    [entityId]
  )
  return rows
}

export async function getUserProfileById(id: string, entityId: string): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    `SELECT p.*, u.email, u.full_name FROM crm_user_profiles p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1 AND p.entity_id = $2`,
    [id, entityId]
  )
  return rows[0] || null
}

export async function updateUserProfile(
  id: string,
  entityId: string,
  updates: { role?: string }
): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    'UPDATE crm_user_profiles SET role = COALESCE($3, role), updated_at = NOW() WHERE id = $1 AND entity_id = $2 RETURNING *',
    [id, entityId, updates.role || null]
  )
  return rows[0] || null
}
