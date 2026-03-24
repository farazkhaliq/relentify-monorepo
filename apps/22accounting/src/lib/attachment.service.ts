import { query } from '@/src/lib/db';
import { getStorageProvider } from '@/src/lib/storage';
import { compressAttachment } from '@/src/lib/compress-attachment';

export type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction' | 'comment';

export interface Attachment {
  id: string;
  record_type: RecordType;
  record_id: string;
  file_key: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  url: string;  // either presigned R2 URL or local /api/attachments/[id]/file path
}

export async function getAttachments(
  entityId: string,
  recordType: RecordType,
  recordId: string
): Promise<Attachment[]> {
  const result = await query(
    `SELECT * FROM attachments
     WHERE entity_id=$1 AND record_type=$2 AND record_id=$3
     ORDER BY created_at ASC`,
    [entityId, recordType, recordId]
  );
  const storage = getStorageProvider();
  return Promise.all(
    (result.rows as Attachment[]).map(async (a) => {
      const remoteUrl = await storage.getUrl(a.file_key);
      a.url = remoteUrl ?? `/api/attachments/${a.id}/file`;
      return a;
    })
  );
}

export async function createAttachment(params: {
  entityId: string;
  recordType: RecordType;
  recordId: string;
  fileBuffer: Buffer;
  fileName: string;
  originalMimeType: string;
  uploadedBy: string;
}): Promise<Attachment> {
  // Allocate ID first so storage can use it as the key
  const idResult = await query(`SELECT gen_random_uuid() AS id`);
  const id: string = idResult.rows[0].id;

  // Compress before storing
  const { buffer, mimeType } = await compressAttachment(
    params.fileBuffer,
    params.originalMimeType
  );

  // Derive output filename — keep original name but fix extension for converted images
  let fileName = params.fileName;
  if (mimeType === 'image/webp' && !fileName.endsWith('.webp')) {
    fileName = fileName.replace(/\.[^.]+$/, '') + '.webp';
  }

  // Insert metadata row FIRST so the FK constraint on attachment_data is satisfied
  const placeholderKey = id; // will be updated after upload if key differs
  const result = await query(
    `INSERT INTO attachments
       (id, entity_id, record_type, record_id, file_key, file_name, file_size, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, params.entityId, params.recordType, params.recordId,
     placeholderKey, fileName, buffer.length, mimeType, params.uploadedBy]
  );

  // Upload to storage backend (attachment_data FK is now satisfied)
  const storage = getStorageProvider();
  const fileKey = await storage.upload(id, buffer, mimeType);

  const attachment = result.rows[0] as Attachment;
  const remoteUrl = await storage.getUrl(fileKey);
  attachment.url = remoteUrl ?? `/api/attachments/${id}/file`;
  return attachment;
}

export async function deleteAttachment(
  id: string,
  entityId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    `SELECT file_key FROM attachments WHERE id=$1 AND entity_id=$2 AND uploaded_by=$3`,
    [id, entityId, userId]
  );
  if (result.rows.length === 0) return false;

  const storage = getStorageProvider();
  await storage.delete(result.rows[0].file_key);
  await query(`DELETE FROM attachments WHERE id=$1`, [id]);
  return true;
}

export async function getAttachmentFile(
  id: string,
  entityId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  const result = await query(
    `SELECT file_key, mime_type, file_name FROM attachments WHERE id=$1 AND entity_id=$2`,
    [id, entityId]
  );
  if (result.rows.length === 0) return null;

  const { file_key, mime_type, file_name } = result.rows[0];
  const storage = getStorageProvider();
  const buffer = await storage.download(file_key);
  if (!buffer) return null;

  return { buffer, mimeType: mime_type ?? 'application/octet-stream', fileName: file_name };
}
