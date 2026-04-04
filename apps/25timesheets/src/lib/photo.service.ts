import { query } from './db'
import { createHash } from 'crypto'

export async function storePhoto(
  entryId: string, photoType: 'clock_in' | 'clock_out', imageBuffer: Buffer
): Promise<{ photoId: string; hash: string; reuseDetected: boolean }> {
  const hash = createHash('sha256').update(imageBuffer).digest('hex')

  // Check for reuse
  const entry = await query(`SELECT worker_user_id FROM ts_entries WHERE id = $1`, [entryId])
  const workerId = entry.rows[0]?.worker_user_id
  let reuseDetected = false
  if (workerId) {
    const reuse = await query(
      `SELECT id FROM ts_photos WHERE hash = $1
       AND entry_id IN (SELECT id FROM ts_entries WHERE worker_user_id = $2 AND id != $3)
       AND created_at > NOW() - INTERVAL '30 days' LIMIT 1`,
      [hash, workerId, entryId]
    )
    reuseDetected = reuse.rows.length > 0
  }

  // Insert photo metadata
  const photo = await query(
    `INSERT INTO ts_photos (entry_id, photo_type, hash, size_bytes) VALUES ($1, $2, $3, $4) RETURNING id`,
    [entryId, photoType, hash, imageBuffer.length]
  )
  const photoId = photo.rows[0].id

  // Insert photo data
  await query(`INSERT INTO ts_photo_data (photo_id, data) VALUES ($1, $2)`, [photoId, imageBuffer])

  // Update entry with photo URL and hash
  const urlField = photoType === 'clock_in' ? 'clock_in_photo_url' : 'clock_out_photo_url'
  const hashField = photoType === 'clock_in' ? 'clock_in_photo_hash' : 'clock_out_photo_hash'
  await query(
    `UPDATE ts_entries SET ${urlField} = $2, ${hashField} = $3, updated_at = NOW() WHERE id = $1`,
    [entryId, `/api/photos/${photoId}`, hash]
  )

  return { photoId, hash, reuseDetected }
}

export async function getPhoto(photoId: string): Promise<Buffer | null> {
  const r = await query(`SELECT data FROM ts_photo_data WHERE photo_id = $1`, [photoId])
  return r.rows[0]?.data || null
}
