import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/src/lib/db'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all workspace settings
  const settings = await query(`SELECT DISTINCT user_id, entity_id, gps_retention_days, photo_retention_days FROM ts_settings`)

  let pingsDeleted = 0
  let photosDeleted = 0

  for (const s of settings.rows) {
    // Delete old GPS pings
    const pings = await query(
      `DELETE FROM ts_gps_pings WHERE entry_id IN (
         SELECT id FROM ts_entries WHERE user_id = $1 AND entity_id = $2
       ) AND captured_at < NOW() - INTERVAL '1 day' * $3`,
      [s.user_id, s.entity_id, s.gps_retention_days || 90]
    )
    pingsDeleted += pings.rowCount ?? 0

    // Delete old photo data
    const photos = await query(
      `DELETE FROM ts_photo_data WHERE photo_id IN (
         SELECT id FROM ts_photos WHERE created_at < NOW() - INTERVAL '1 day' * $1
       )`,
      [s.photo_retention_days || 90]
    )
    photosDeleted += photos.rowCount ?? 0
  }

  return NextResponse.json({ pingsDeleted, photosDeleted, timestamp: new Date().toISOString() })
}
