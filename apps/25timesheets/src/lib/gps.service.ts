import { query } from './db'
import { isWithinGeofence } from './geo.service'

export async function recordPing(entryId: string, data: {
  latitude: number; longitude: number; accuracy: number; source: string
}): Promise<void> {
  const entryResult = await query(`SELECT * FROM ts_entries WHERE id = $1`, [entryId])
  const entry = entryResult.rows[0]
  if (!entry) return

  let isWithin: boolean | null = null
  if (entry.site_id) {
    const siteResult = await query(`SELECT * FROM ts_sites WHERE id = $1`, [entry.site_id])
    const site = siteResult.rows[0]
    if (site?.latitude && site?.longitude) {
      const geo = isWithinGeofence(data.latitude, data.longitude, site)
      isWithin = geo.within
    }
  }

  await query(
    `INSERT INTO ts_gps_pings (entry_id, latitude, longitude, accuracy_metres, is_within_geofence, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entryId, data.latitude, data.longitude, data.accuracy, isWithin, data.source]
  )

  // Update summary fields
  await query(
    `UPDATE ts_entries SET
       gps_ping_count = gps_ping_count + 1,
       gps_pings_in_fence = gps_pings_in_fence + CASE WHEN $2 THEN 1 ELSE 0 END,
       gps_verification_pct = CASE WHEN gps_ping_count + 1 > 0
         THEN ((gps_pings_in_fence + CASE WHEN $2 THEN 1 ELSE 0 END) * 100.0) / (gps_ping_count + 1)
         ELSE 0 END
     WHERE id = $1`,
    [entryId, isWithin]
  )
}
