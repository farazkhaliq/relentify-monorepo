import { PostgresStorageProvider } from './postgres';

export interface StorageProvider {
  /**
   * Store a file. Returns the file_key to save in the attachments table.
   * attachmentId is the UUID already allocated for the attachment row.
   */
  upload(attachmentId: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Retrieve file bytes for serving (used by Postgres backend).
   * R2 backend returns null — callers should redirect to the presigned URL instead.
   */
  download(fileKey: string): Promise<Buffer | null>;

  /** Delete stored file. */
  delete(fileKey: string): Promise<void>;

  /**
   * Returns a URL the browser can use to access the file.
   * Postgres backend: returns null (caller must use the /api/attachments/[id]/file route).
   * R2 backend: returns a presigned URL.
   */
  getUrl(fileKey: string): Promise<string | null>;
}

export function getStorageProvider(): StorageProvider {
  const backend = process.env.STORAGE_BACKEND ?? 'postgres';
  if (backend === 'r2') {
    // Lazy-load R2 provider — only used when env var is set
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { R2StorageProvider } = require('./r2');
    return new R2StorageProvider();
  }
  return new PostgresStorageProvider();
}
