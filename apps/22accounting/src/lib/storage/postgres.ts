import { query } from '@/src/lib/db';
import type { StorageProvider } from './index';

export class PostgresStorageProvider implements StorageProvider {
  async upload(attachmentId: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const fileKey = attachmentId; // use the UUID as the logical key
    await query(
      `INSERT INTO acc_attachment_data (attachment_id, data) VALUES ($1, $2)
       ON CONFLICT (attachment_id) DO UPDATE SET data = EXCLUDED.data`,
      [attachmentId, buffer]
    );
    return fileKey;
  }

  async download(fileKey: string): Promise<Buffer | null> {
    const result = await query(
      `SELECT data FROM acc_attachment_data WHERE attachment_id = $1`,
      [fileKey]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].data as Buffer;
  }

  async delete(fileKey: string): Promise<void> {
    // Cascade delete handles attachment_data; this is a no-op at storage level
    // but kept for interface consistency
    await query(`DELETE FROM acc_attachment_data WHERE attachment_id = $1`, [fileKey]);
  }

  async getUrl(_fileKey: string): Promise<null> {
    // Postgres backend serves files through the Next.js API route
    return null;
  }
}
