# File Attachments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users on `small_business`+ to attach receipts and PDFs to bills, expenses, mileage claims, and bank transactions. Images are compressed ~10x before storage. Storage backend is swappable between Postgres (default, zero setup) and Cloudflare R2 (production scale) via env var.

**Architecture:** A `StorageProvider` interface abstracts all file I/O. `PostgresStorageProvider` stores bytea in a separate `attachment_data` table and serves files via an API route. `R2StorageProvider` uses the AWS S3 SDK and returns presigned URLs. Images are compressed with `sharp` (→ WEBP @ q80, max 2000px) before hitting storage. The `attachments` table never holds binary data, keeping list queries fast regardless of backend.

**Tech Stack:** `sharp` for image compression, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for R2 (only installed when needed), Next.js `request.formData()` for multipart upload, Postgres bytea for default storage.

---

## Pre-flight: Install packages

```bash
cd /opt/relentify-monorepo
pnpm add sharp --filter accounting
pnpm add @types/sharp --filter accounting
pnpm install
```

To enable R2 later (no need now):
```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --filter accounting
pnpm install
```

---

## Chunk 1: Data Layer

### Task 1: DB migration

**Files:**
- Create: `database/migrations/020_attachments.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration 020: File attachments

-- Main metadata table — never stores binary data
CREATE TABLE IF NOT EXISTS attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  record_type  TEXT NOT NULL,   -- 'bill' | 'expense' | 'mileage' | 'bank_transaction'
  record_id    UUID NOT NULL,
  file_key     TEXT NOT NULL,   -- logical key used by all backends (R2 object key or UUID path)
  file_name    TEXT NOT NULL,   -- original filename shown to user
  file_size    INTEGER,         -- post-compression bytes
  mime_type    TEXT,            -- mime type after compression (may differ from upload)
  uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_record
  ON attachments(entity_id, record_type, record_id);

-- Postgres storage backend: binary data lives here, not in attachments
-- Only populated when STORAGE_BACKEND=postgres (default)
CREATE TABLE IF NOT EXISTS attachment_data (
  attachment_id UUID PRIMARY KEY REFERENCES attachments(id) ON DELETE CASCADE,
  data          BYTEA NOT NULL
);
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify \
  < /opt/relentify-monorepo/apps/22accounting/database/migrations/020_attachments.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `CREATE TABLE`

- [ ] **Step 3: Verify**

```bash
docker exec infra-postgres psql -U relentify_user -d relentify \
  -c "\dt attachments" -c "\dt attachment_data"
```

---

## Chunk 2: Storage Abstraction + Compression

### Task 2: `StorageProvider` interface + Postgres implementation

**Files:**
- Create: `src/lib/storage/index.ts`
- Create: `src/lib/storage/postgres.ts`

- [ ] **Step 1: Write `src/lib/storage/index.ts`**

```typescript
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
  const { PostgresStorageProvider } = require('./postgres');
  return new PostgresStorageProvider();
}
```

- [ ] **Step 2: Write `src/lib/storage/postgres.ts`**

```typescript
import { query } from '@/src/lib/db';
import type { StorageProvider } from './index';

export class PostgresStorageProvider implements StorageProvider {
  async upload(attachmentId: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const fileKey = attachmentId; // use the UUID as the logical key
    await query(
      `INSERT INTO attachment_data (attachment_id, data) VALUES ($1, $2)
       ON CONFLICT (attachment_id) DO UPDATE SET data = EXCLUDED.data`,
      [attachmentId, buffer]
    );
    return fileKey;
  }

  async download(fileKey: string): Promise<Buffer | null> {
    const result = await query(
      `SELECT data FROM attachment_data WHERE attachment_id = $1`,
      [fileKey]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].data as Buffer;
  }

  async delete(fileKey: string): Promise<void> {
    // Cascade delete handles attachment_data; this is a no-op at storage level
    // but kept for interface consistency
    await query(`DELETE FROM attachment_data WHERE attachment_id = $1`, [fileKey]);
  }

  async getUrl(_fileKey: string): Promise<null> {
    // Postgres backend serves files through the Next.js API route
    return null;
  }
}
```

---

### Task 3: R2 storage implementation

**Files:**
- Create: `src/lib/storage/r2.ts`

This file is only executed when `STORAGE_BACKEND=r2`. The `@aws-sdk` packages don't need to be installed until then.

- [ ] **Step 1: Write `src/lib/storage/r2.ts`**

```typescript
import type { StorageProvider } from './index';

export class R2StorageProvider implements StorageProvider {
  private getClient() {
    // Dynamic import so the file can exist without @aws-sdk installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require('@aws-sdk/client-s3');
    return new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  private get bucket(): string {
    return process.env.R2_BUCKET_NAME!;
  }

  async upload(attachmentId: string, buffer: Buffer, mimeType: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const fileKey = `attachments/${attachmentId}`;
    await this.getClient().send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }));
    return fileKey;
  }

  async download(_fileKey: string): Promise<null> {
    // R2 serves via presigned URL, not through this app
    return null;
  }

  async delete(fileKey: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }));
  }

  async getUrl(fileKey: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: 3600 }
    );
  }
}
```

---

### Task 4: Compression (images via sharp, PDFs via Ghostscript)

**Files:**
- Create: `src/lib/compress-attachment.ts`
- Modify: `Dockerfile`

Ghostscript is the standard tool for PDF compression. At `/ebook` preset (150 DPI) a 10MB scanned receipt typically compresses to 1–2MB while remaining clearly legible. Images use `sharp` → WEBP @ q80, max 2000px.

- [ ] **Step 1: Add Ghostscript to the runner stage of `Dockerfile`**

The runner stage is where the app runs in production. Add `ghostscript` to the existing `apk add` line:

```dockerfile
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ghostscript
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
```

- [ ] **Step 2: Write `src/lib/compress-attachment.ts`**

```typescript
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

const MAX_DIMENSION = 2000;  // px — sufficient for receipt legibility
const WEBP_QUALITY = 80;     // visually lossless for documents
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CompressResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Compress an uploaded file before storage.
 * Images  → WEBP @ q80, max 2000px longest edge (via sharp).
 * PDFs    → Ghostscript /ebook preset (150 DPI). 10MB → ~1–2MB typical.
 * Always returns the smaller of compressed vs original.
 */
export async function compressAttachment(
  buffer: Buffer,
  originalMimeType: string
): Promise<CompressResult> {
  if (IMAGE_TYPES.includes(originalMimeType)) {
    return compressImage(buffer, originalMimeType);
  }
  if (originalMimeType === 'application/pdf') {
    return compressPdf(buffer);
  }
  return { buffer, mimeType: originalMimeType };
}

async function compressImage(buffer: Buffer, originalMimeType: string): Promise<CompressResult> {
  const compressed = await sharp(buffer)
    .rotate()                    // auto-rotate from EXIF (fixes phone photos)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',             // preserves aspect ratio, never upscales
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  if (compressed.length < buffer.length) {
    return { buffer: compressed, mimeType: 'image/webp' };
  }
  return { buffer, mimeType: originalMimeType };
}

async function compressPdf(buffer: Buffer): Promise<CompressResult> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `${id}-in.pdf`);
  const outputPath = join(tmpdir(), `${id}-out.pdf`);

  try {
    await writeFile(inputPath, buffer);

    // /ebook = 150 DPI — good balance of size and legibility for receipts
    await execAsync(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook ` +
      `-dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`
    );

    const compressed = await readFile(outputPath);
    if (compressed.length < buffer.length) {
      return { buffer: compressed, mimeType: 'application/pdf' };
    }
    return { buffer, mimeType: 'application/pdf' };
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
```

---

## Chunk 3: Attachment Service + API

### Task 5: Attachment service

**Files:**
- Create: `src/lib/attachment.service.ts`

- [ ] **Step 1: Write `src/lib/attachment.service.ts`**

```typescript
import { query } from '@/src/lib/db';
import { getStorageProvider } from '@/src/lib/storage';
import { compressAttachment } from '@/src/lib/compress-attachment';

export type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction';

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
  const { buffer, mimeType, originalSize: _orig } = await compressAttachment(
    params.fileBuffer,
    params.originalMimeType
  );

  // Upload to storage backend
  const storage = getStorageProvider();
  const fileKey = await storage.upload(id, buffer, mimeType);

  // Derive output filename — keep original name but fix extension for converted images
  let fileName = params.fileName;
  if (mimeType === 'image/webp' && !fileName.endsWith('.webp')) {
    fileName = fileName.replace(/\.[^.]+$/, '') + '.webp';
  }

  // Insert metadata row
  const result = await query(
    `INSERT INTO attachments
       (id, entity_id, record_type, record_id, file_key, file_name, file_size, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, params.entityId, params.recordType, params.recordId,
     fileKey, fileName, buffer.length, mimeType, params.uploadedBy]
  );

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
```

---

### Task 6: Upload + list endpoint

**Files:**
- Create: `app/api/attachments/route.ts`

- [ ] **Step 1: Write `app/api/attachments/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { createAttachment, getAttachments, type RecordType } from '@/src/lib/attachment.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB upload cap (compressed result will be much smaller)

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use file attachments' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const recordType = searchParams.get('recordType') as RecordType | null;
    const recordId = searchParams.get('recordId');
    if (!recordType || !recordId) {
      return NextResponse.json({ error: 'recordType and recordId are required' }, { status: 400 });
    }

    const attachments = await getAttachments(entity.id, recordType, recordId);
    return NextResponse.json({ attachments });
  } catch (e) {
    console.error('GET attachments error:', e);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use file attachments' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const recordType = formData.get('recordType') as RecordType | null;
    const recordId = formData.get('recordId') as string | null;

    if (!file || !recordType || !recordId) {
      return NextResponse.json({ error: 'file, recordType, and recordId are required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, JPEG, PNG, or WEBP files are allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be under 20MB' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const attachment = await createAttachment({
      entityId: entity.id,
      recordType,
      recordId,
      fileBuffer,
      fileName: file.name,
      originalMimeType: file.type,
      uploadedBy: auth.userId,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (e) {
    console.error('POST attachment error:', e);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}
```

---

### Task 7: Delete + file-serve endpoints

**Files:**
- Create: `app/api/attachments/[id]/route.ts`

- [ ] **Step 1: Write `app/api/attachments/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { deleteAttachment, getAttachmentFile } from '@/src/lib/attachment.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  // Serve file bytes — used by Postgres storage backend
  try {
    const auth = await getAuthUser();
    if (!auth) return new NextResponse('Unauthorized', { status: 401 });

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return new NextResponse('No active entity', { status: 400 });

    const { id } = await params;
    const file = await getAttachmentFile(id, entity.id);
    if (!file) return new NextResponse('Not found', { status: 404 });

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('GET attachment file error:', e);
    return new NextResponse('Failed', { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'capture_bills_receipts')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { id } = await params;
    const deleted = await deleteAttachment(id, entity.id, auth.userId);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE attachment error:', e);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
```

---

## Chunk 4: Shared UI Component

### Task 8: `<Attachments />` component

**Files:**
- Create: `src/components/Attachments.tsx`

The `url` field from the API works for both backends — either a presigned R2 URL or a local `/api/attachments/[id]/file` path.

- [ ] **Step 1: Write `src/components/Attachments.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@relentify/ui';

type RecordType = 'bill' | 'expense' | 'mileage' | 'bank_transaction';

interface Attachment {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  url: string;
  created_at: string;
}

interface Props {
  recordType: RecordType;
  recordId: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black uppercase tracking-widest ${isPdf ? 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]' : 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'}`}>
      {isPdf ? 'PDF' : 'IMG'}
    </div>
  );
}

export default function Attachments({ recordType, recordId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [recordType, recordId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/attachments?recordType=${recordType}&recordId=${recordId}`);
      const d = await r.json();
      if (d.attachments) setAttachments(d.attachments);
    } catch { /* silently ignore — not critical */ }
    finally { setLoading(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('recordType', recordType);
      form.append('recordId', recordId);
      const r = await fetch('/api/attachments', { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Upload failed');
      setAttachments(prev => [...prev, d.attachment]);
      toast('Attachment uploaded', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      const r = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
      setAttachments(prev => prev.filter(a => a.id !== id));
      toast('Attachment deleted', 'success');
    } catch { toast('Failed to delete attachment', 'error'); }
  }

  const labelCls = 'text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest block mb-3';

  return (
    <div className="mt-6 pt-6 border-t border-white/[0.07]">
      <span className={labelCls}>Attachments</span>

      {loading ? (
        <div className="text-[var(--theme-text-muted)] text-sm">Loading...</div>
      ) : (
        <>
          {attachments.length > 0 && (
            <ul className="space-y-2 mb-4">
              {attachments.map(a => (
                <li key={a.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                  <FileIcon mimeType={a.mime_type} />
                  <div className="flex-1 min-w-0">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--theme-text)] hover:text-[var(--theme-accent)] truncate block no-underline"
                    >
                      {a.file_name}
                    </a>
                    {a.file_size && (
                      <span className="text-[10px] text-[var(--theme-text-muted)]">{formatBytes(a.file_size)}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(a.id, a.file_name)}
                    className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] transition-colors text-lg leading-none bg-transparent border-none cursor-pointer shrink-0"
                    title="Delete"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/[0.06] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attach Receipt
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
```

---

## Chunk 5: UI Integration

### Task 9: Bills detail page

**Files:**
- Modify: `app/dashboard/bills/[id]/page.tsx`

- [ ] **Step 1: Add import at top**

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add `<Attachments />` inside `<main>`, after the detail card and before the delete button**

```tsx
        <Attachments recordType="bill" recordId={id} />

        <button
          onClick={deleteBill}
```

---

### Task 10: Expenses page — per-row attachment toggle

**Files:**
- Modify: `app/dashboard/expenses/page.tsx`

- [ ] **Step 1: Add import**

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add two state vars near other state declarations**

```typescript
const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
const [expandedMileageId, setExpandedMileageId] = useState<string | null>(null);
```

- [ ] **Step 3: Add 📎 button + expandable panel to each expense row**

Inside the expense list rendering, alongside existing action buttons:

```tsx
<button
  onClick={() => setExpandedExpenseId(expandedExpenseId === expense.id ? null : expense.id)}
  className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border border-white/10 rounded-lg px-2 py-1 transition-colors"
  title="Attachments"
>📎</button>

{expandedExpenseId === expense.id && (
  <div className="mt-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
    <Attachments recordType="expense" recordId={expense.id} />
  </div>
)}
```

Apply the same pattern to mileage rows: `expandedMileageId` / `setExpandedMileageId`, `recordType="mileage"`.

---

### Task 11: Banking page — per-transaction attachment toggle

**Files:**
- Modify: `app/dashboard/banking/page.tsx`

- [ ] **Step 1: Add import**

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add state var**

```typescript
const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
```

- [ ] **Step 3: Add toggle + expandable panel to each transaction row**

```tsx
<button
  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
  className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest border border-white/10 rounded-lg px-2 py-1 transition-colors bg-transparent"
  title="Attachments"
>📎</button>

{expandedTxId === tx.id && (
  <div className="mt-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
    <Attachments recordType="bank_transaction" recordId={tx.id} />
  </div>
)}
```

---

## Chunk 6: Deploy

### Task 12: Build and deploy

- [ ] **Step 1: Install sharp**

```bash
cd /opt/relentify-monorepo
pnpm add sharp --filter accounting
pnpm add @types/sharp --filter accounting
pnpm install
```

> Ghostscript is installed at Docker build time via the Dockerfile change in Task 4. No separate package install needed.

- [ ] **Step 2: Set default env var (Postgres backend, no R2 setup needed)**

Add to `/opt/relentify-monorepo/apps/22accounting/.env`:
```
STORAGE_BACKEND=postgres
```

- [ ] **Step 3: Build and deploy**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50
docker builder prune -f
```

- [ ] **Step 4: Smoke test**

1. Open a bill detail → "Attach Receipt" appears at bottom
2. Upload a JPEG → appears in list with compressed size shown
3. Click filename → opens file in new tab
4. Click ✕ → removed
5. Expenses page → 📎 on each row → expands → upload works
6. Banking page → same

---

## Switching to R2 later

When ready for R2:

```bash
# Install SDK
cd /opt/relentify-monorepo
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --filter accounting
pnpm install
```

Add to `.env`:
```
STORAGE_BACKEND=r2
R2_ACCOUNT_ID=<cloudflare_account_id>
R2_ACCESS_KEY_ID=<r2_access_key>
R2_SECRET_ACCESS_KEY=<r2_secret>
R2_BUCKET_NAME=relentify-attachments
```

Rebuild. **Existing Postgres attachments remain accessible** — the `attachment_data` table is not deleted. New uploads go to R2.

If you want to migrate old files to R2, write a one-off script that reads from `attachment_data`, uploads to R2, updates `file_key`, and deletes from `attachment_data`.

---

## Update CLAUDE.md after completion

- Change `Priority 4 | 🔴` → `Priority 4 | ✅`
- Add migration 020 to the "Migrations applied" line
- Add to Key Files table: `src/lib/storage/index.ts`, `src/lib/storage/postgres.ts`, `src/lib/storage/r2.ts`, `src/lib/attachment.service.ts`, `src/lib/compress-attachment.ts`
- Add `STORAGE_BACKEND`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` to env var notes

---

## Summary of files

| Action | File |
|--------|------|
| Create | `database/migrations/020_attachments.sql` |
| Create | `src/lib/storage/index.ts` |
| Create | `src/lib/storage/postgres.ts` |
| Create | `src/lib/storage/r2.ts` |
| Create | `src/lib/compress-attachment.ts` |
| Create | `src/lib/attachment.service.ts` |
| Create | `app/api/attachments/route.ts` |
| Create | `app/api/attachments/[id]/route.ts` |
| Create | `src/components/Attachments.tsx` |
| Modify | `app/dashboard/bills/[id]/page.tsx` |
| Modify | `app/dashboard/expenses/page.tsx` |
| Modify | `app/dashboard/banking/page.tsx` |
