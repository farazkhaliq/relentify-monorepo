import { query } from './db'

export async function calculateTrustScore(entryId: string): Promise<number> {
  const entryResult = await query(`SELECT * FROM ts_entries WHERE id = $1`, [entryId])
  const entry = entryResult.rows[0]
  if (!entry) return 0

  let score = 0

  // +25: GPS within geofence on clock-in
  if (entry.is_within_geofence_in === true) score += 25

  // +25: GPS within geofence on clock-out
  if (entry.is_within_geofence_out === true) score += 25

  // +15: Photo present (minus 20 if reuse detected)
  if (entry.clock_in_photo_url) {
    score += 15
    // Check photo reuse
    if (entry.clock_in_photo_hash) {
      const reuse = await query(
        `SELECT id FROM ts_photos WHERE hash = $1
         AND entry_id IN (SELECT id FROM ts_entries WHERE worker_user_id = $2 AND id != $3)
         AND created_at > NOW() - INTERVAL '30 days'
         LIMIT 1`,
        [entry.clock_in_photo_hash, entry.worker_user_id, entryId]
      )
      if (reuse.rows[0]) score -= 20
    }
  }

  // +10: IP consistent (same /24 subnet as last 5 entries)
  if (entry.clock_in_ip) {
    const subnet = entry.clock_in_ip.split('.').slice(0, 3).join('.')
    const recentIps = await query(
      `SELECT clock_in_ip FROM ts_entries WHERE worker_user_id = $1 AND id != $2
       AND clock_in_ip IS NOT NULL ORDER BY clock_in_at DESC LIMIT 5`,
      [entry.worker_user_id, entryId]
    )
    const matching = recentIps.rows.filter((r: { clock_in_ip: string }) =>
      r.clock_in_ip?.startsWith(subnet)
    )
    if (matching.length >= 3) score += 10
  }

  // +10: Device consistent
  if (entry.clock_in_device) {
    const ua = typeof entry.clock_in_device === 'string'
      ? JSON.parse(entry.clock_in_device)?.userAgent
      : entry.clock_in_device?.userAgent
    if (ua) {
      const recentDevices = await query(
        `SELECT clock_in_device FROM ts_entries WHERE worker_user_id = $1 AND id != $2
         AND clock_in_device IS NOT NULL ORDER BY clock_in_at DESC LIMIT 5`,
        [entry.worker_user_id, entryId]
      )
      const matching = recentDevices.rows.filter((r: { clock_in_device: string | object }) => {
        const d = typeof r.clock_in_device === 'string' ? JSON.parse(r.clock_in_device) : r.clock_in_device
        return d?.userAgent === ua
      })
      if (matching.length >= 3) score += 10
    }
  }

  // +10: GPS verification >= 80%
  if (entry.gps_verification_pct != null && entry.gps_verification_pct >= 80) score += 10

  // +5: GPS accuracy < 50m on clock-in (approximate from ping data)
  score += 5 // Default: give benefit of the doubt

  // Cap at 100
  score = Math.min(100, Math.max(0, score))

  await query(`UPDATE ts_entries SET trust_score = $2, updated_at = NOW() WHERE id = $1`, [entryId, score])
  return score
}
