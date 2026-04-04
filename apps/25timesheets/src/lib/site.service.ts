import { query } from './db'

export interface TsSite {
  id: string
  user_id: string
  entity_id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  geofence_radius_metres: number | null
  require_photo_on_punch: boolean
  is_active: boolean
}

export async function createSite(data: {
  userId: string; entityId: string; name: string; address?: string;
  latitude?: number; longitude?: number; geofenceRadius?: number; requirePhoto?: boolean
}): Promise<TsSite> {
  const r = await query(
    `INSERT INTO ts_sites (user_id, entity_id, name, address, latitude, longitude, geofence_radius_metres, require_photo_on_punch)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.userId, data.entityId, data.name, data.address || null, data.latitude || null,
     data.longitude || null, data.geofenceRadius || null, data.requirePhoto || false]
  )
  return r.rows[0]
}

export async function getSiteById(siteId: string, userId: string, entityId: string): Promise<TsSite | null> {
  const r = await query(
    `SELECT * FROM ts_sites WHERE id = $1 AND user_id = $2 AND entity_id = $3`,
    [siteId, userId, entityId]
  )
  return r.rows[0] || null
}

export async function updateSite(siteId: string, userId: string, data: Partial<TsSite>): Promise<TsSite | null> {
  const allowed = ['name', 'address', 'latitude', 'longitude', 'geofence_radius_metres', 'require_photo_on_punch', 'is_active']
  const fields = Object.entries(data).filter(([k]) => allowed.includes(k))
  if (fields.length === 0) return getSiteById(siteId, userId, data.entity_id || '')

  const setClauses = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ')
  const r = await query(
    `UPDATE ts_sites SET ${setClauses}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [siteId, userId, ...fields.map(([, v]) => v)]
  )
  return r.rows[0] || null
}

export async function listSites(userId: string, entityId: string): Promise<TsSite[]> {
  const r = await query(
    `SELECT * FROM ts_sites WHERE user_id = $1 AND entity_id = $2 AND is_active = true ORDER BY name`,
    [userId, entityId]
  )
  return r.rows
}

export async function deactivateSite(siteId: string, userId: string): Promise<boolean> {
  const r = await query(
    `UPDATE ts_sites SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
    [siteId, userId]
  )
  return (r.rowCount ?? 0) > 0
}
