import { query } from '@/src/lib/db'
import { getStorageProvider } from '@/src/lib/storage'
import { Resend } from 'resend'
import { v4 as uuidv4 } from 'uuid'

export async function uploadRecordingToStorage(
  chunks: Buffer[],
  _filename: string
): Promise<string> {
  const combined = Buffer.concat(chunks)
  const provider = getStorageProvider()
  // Use a dedicated UUID as the storage ID so upload() generates key = "attachments/<id>"
  const storageId = uuidv4()
  const fileKey = await provider.upload(storageId, combined, 'video/webm')
  return fileKey
}

export async function logRecordingUpload(params: {
  userId: string
  entityId: string | null
  filename: string
  sizeBytes: number
  storageKey: string
  description: string | null
}): Promise<string> {
  const result = await query(
    `INSERT INTO recording_uploads (user_id, entity_id, filename, size_bytes, storage_key, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [params.userId, params.entityId, params.filename, params.sizeBytes, params.storageKey, params.description]
  )
  return result.rows[0].id
}

export async function getRecordingsForUser(userId: string): Promise<Array<{
  id: string
  filename: string
  description: string | null
  sizeBytes: number
  createdAt: string
  expiresAt: string
}>> {
  const result = await query(
    `SELECT id, filename, description, size_bytes, created_at, expires_at
     FROM recording_uploads
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows.map((r: any) => ({
    id: r.id,
    filename: r.filename,
    description: r.description,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }))
}

export async function getRecordingStorageKey(id: string, userId: string): Promise<string | null> {
  const result = await query(
    `SELECT storage_key FROM recording_uploads WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
    [id, userId]
  )
  return result.rows[0]?.storage_key ?? null
}

export async function sendSupportEmail(params: {
  userEmail: string
  description: string
  recordingId: string
}): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL
  if (!supportEmail) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'invoices@relentify.com',
    to: supportEmail,
    subject: `Recording submitted — ${params.userEmail}`,
    html: `
      <p><strong>From:</strong> ${params.userEmail}</p>
      <p><strong>Description:</strong> ${params.description || '(none)'}</p>
      <p><strong>Recording ID:</strong> ${params.recordingId}</p>
      <p><small>To view this recording, access the admin panel or query the recording_uploads table directly.</small></p>
    `,
  })
}
