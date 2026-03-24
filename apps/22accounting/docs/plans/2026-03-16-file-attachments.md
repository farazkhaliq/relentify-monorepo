# File Attachments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users on `small_business`+ to attach receipts and PDFs to bills, expenses, mileage claims, and bank transactions for audit-ready records.

**Architecture:** Server-side upload through a Next.js API route to Cloudflare R2 (S3-compatible). Attachments stored with `file_key` in a new `attachments` table; presigned GET URLs generated on-demand. Shared `<Attachments />` React component used on all detail views. Tier-gated by existing `capture_bills_receipts` feature.

**Tech Stack:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for R2, Next.js multipart form handling via `request.formData()`, Cloudflare R2 as storage backend.

---

## Pre-flight: R2 Setup (manual, do once)

Before any code:

1. Create a Cloudflare R2 bucket named `relentify-attachments` (private, no public access).
2. Create an R2 API token with `Object Read & Write` on that bucket.
3. Add to `/opt/relentify-monorepo/apps/22accounting/.env`:

```
R2_ACCOUNT_ID=<cloudflare_account_id>
R2_ACCESS_KEY_ID=<r2_access_key>
R2_SECRET_ACCESS_KEY=<r2_secret>
R2_BUCKET_NAME=relentify-attachments
```

4. Install SDK in the `accounting` app:
```bash
cd /opt/relentify-monorepo
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
-- Stores uploaded files linked to any record type (bill, expense, mileage, bank_transaction)

CREATE TABLE IF NOT EXISTS attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  record_type  TEXT NOT NULL,   -- 'bill' | 'expense' | 'mileage' | 'bank_transaction'
  record_id    UUID NOT NULL,
  file_key     TEXT NOT NULL,   -- R2 object key (path in bucket)
  file_name    TEXT NOT NULL,   -- original filename shown to user
  file_size    INTEGER,         -- bytes
  mime_type    TEXT,            -- 'application/pdf' | 'image/jpeg' | etc.
  uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(entity_id, record_type, record_id);
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/22accounting/database/migrations/020_attachments.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`

- [ ] **Step 3: Verify table exists**

```bash
docker exec infra-postgres psql -U relentify_user -d relentify -c "\d attachments"
```

Expected: table description showing all columns.

---

### Task 2: R2 client + attachment service

**Files:**
- Create: `src/lib/r2.ts`
- Create: `src/lib/attachment.service.ts`

- [ ] **Step 1: Write `src/lib/r2.ts`**

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function deleteFromR2(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn });
}
```

- [ ] **Step 2: Write `src/lib/attachment.service.ts`**

```typescript
import { query } from '@/src/lib/db';
import { deleteFromR2, getPresignedUrl } from '@/src/lib/r2';

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
  signed_url?: string;
}

export async function getAttachments(
  entityId: string,
  recordType: RecordType,
  recordId: string
): Promise<Attachment[]> {
  const result = await query(
    `SELECT * FROM attachments WHERE entity_id=$1 AND record_type=$2 AND record_id=$3 ORDER BY created_at ASC`,
    [entityId, recordType, recordId]
  );
  const attachments = result.rows as Attachment[];
  // Enrich with presigned URLs
  for (const a of attachments) {
    a.signed_url = await getPresignedUrl(a.file_key);
  }
  return attachments;
}

export async function createAttachment(params: {
  entityId: string;
  recordType: RecordType;
  recordId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
}): Promise<Attachment> {
  const result = await query(
    `INSERT INTO attachments (entity_id, record_type, record_id, file_key, file_name, file_size, mime_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [params.entityId, params.recordType, params.recordId, params.fileKey,
     params.fileName, params.fileSize, params.mimeType, params.uploadedBy]
  );
  const attachment = result.rows[0] as Attachment;
  attachment.signed_url = await getPresignedUrl(attachment.file_key);
  return attachment;
}

export async function deleteAttachment(
  id: string,
  entityId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership before delete
  const result = await query(
    `SELECT file_key FROM attachments WHERE id=$1 AND entity_id=$2 AND uploaded_by=$3`,
    [id, entityId, userId]
  );
  if (result.rows.length === 0) return false;
  const { file_key } = result.rows[0];
  await deleteFromR2(file_key);
  await query(`DELETE FROM attachments WHERE id=$1`, [id]);
  return true;
}
```

---

## Chunk 2: API Routes

### Task 3: Upload + list endpoint

**Files:**
- Create: `app/api/attachments/route.ts`

Accepted file types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
Max size: 10MB

- [ ] **Step 1: Write `app/api/attachments/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { uploadToR2 } from '@/src/lib/r2';
import { createAttachment, getAttachments, type RecordType } from '@/src/lib/attachment.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
      return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const fileKey = `${entity.id}/${recordType}/${recordId}/${uuidv4()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(fileKey, buffer, file.type);

    const attachment = await createAttachment({
      entityId: entity.id,
      recordType,
      recordId,
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
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

### Task 4: Delete endpoint

**Files:**
- Create: `app/api/attachments/[id]/route.ts`

- [ ] **Step 1: Write `app/api/attachments/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { deleteAttachment } from '@/src/lib/attachment.service';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (!deleted) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE attachment error:', e);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
```

---

## Chunk 3: Shared UI Component

### Task 5: `<Attachments />` component

**Files:**
- Create: `src/components/Attachments.tsx`

This component handles upload, display, and delete. It's used on all detail views.

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
  signed_url: string;
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

  useEffect(() => {
    load();
  }, [recordType, recordId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/attachments?recordType=${recordType}&recordId=${recordId}`);
      const d = await r.json();
      if (d.attachments) setAttachments(d.attachments);
    } catch {
      // silently ignore — not critical
    } finally {
      setLoading(false);
    }
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
    } catch {
      toast('Failed to delete attachment', 'error');
    }
  }

  const sectionCls = 'mt-6 pt-6 border-t border-white/[0.07]';
  const labelCls = 'text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest block mb-3';

  return (
    <div className={sectionCls}>
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
                      href={a.signed_url}
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
                    title="Delete attachment"
                  >
                    ✕
                  </button>
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
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
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

## Chunk 4: UI Integration

### Task 6: Bill detail page — add attachments

**Files:**
- Modify: `app/dashboard/bills/[id]/page.tsx`

- [ ] **Step 1: Add import**

At the top of the file, after existing imports:

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add `<Attachments />` section**

In the `<main>` block, find the notes section (just before the Delete button). Add after the card `div` that contains the bill details and before the delete button:

```tsx
<Attachments recordType="bill" recordId={id} />
```

Full context — insert after the closing `</div>` of the card with `space-y-5 mb-6` and before the delete `<button>`:

```tsx
        {/* existing card end */}
        </div>

        <Attachments recordType="bill" recordId={id} />

        <button
          onClick={deleteBill}
```

---

### Task 7: Expense page — attachment modal per expense row

The expenses page has no per-expense detail page. Add an inline "Attachments" expandable section per expense row. This uses the same `<Attachments />` component inside a collapsible.

**Files:**
- Modify: `app/dashboard/expenses/page.tsx`

- [ ] **Step 1: Add import to expenses page**

Add after existing imports:

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add expanded-row state**

Add near the top of the component state declarations:

```typescript
const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
const [expandedMileageId, setExpandedMileageId] = useState<string | null>(null);
```

- [ ] **Step 3: Add paperclip button + expandable row to each expense row**

Find the existing expense list rendering (the `<li>` or table row for each expense). Add a clip button alongside the existing row actions, and an expanded panel below.

The pattern (insert after the status badge / reimbursement controls in the expense row):

```tsx
{/* Attachment toggle button — inline with other actions */}
<button
  onClick={() => setExpandedExpenseId(expandedExpenseId === expense.id ? null : expense.id)}
  className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest bg-transparent border border-white/10 rounded-lg px-2 py-1 transition-colors"
  title="Attachments"
>
  📎
</button>

{/* Expandable attachments panel */}
{expandedExpenseId === expense.id && (
  <div className="mt-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
    <Attachments recordType="expense" recordId={expense.id} />
  </div>
)}
```

Apply the same pattern to mileage rows using `expandedMileageId` / `setExpandedMileageId` and `recordType="mileage"`.

---

### Task 8: Banking page — attachment button per transaction

The banking page renders transactions in a list. Add a paperclip button that expands an inline attachments panel per transaction.

**Files:**
- Modify: `app/dashboard/banking/page.tsx`

- [ ] **Step 1: Add import**

```typescript
import Attachments from '@/src/components/Attachments';
```

- [ ] **Step 2: Add expanded transaction state**

```typescript
const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
```

- [ ] **Step 3: Add toggle + panel to each transaction row**

In the transaction row rendering, add a small attach button alongside existing match/ignore buttons. Below each row, render the attachments panel when expanded:

```tsx
{/* Attach button */}
<button
  onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
  className="text-[8px] font-black text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] uppercase tracking-widest border border-white/10 rounded-lg px-2 py-1 transition-colors bg-transparent"
  title="Attachments"
>
  📎
</button>

{/* Expandable attachments */}
{expandedTxId === tx.id && (
  <div className="mt-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
    <Attachments recordType="bank_transaction" recordId={tx.id} />
  </div>
)}
```

---

## Chunk 5: Feature Gate + Tiers

### Task 9: Add `file_attachments` feature to tiers (or use existing `capture_bills_receipts`)

**Note:** `capture_bills_receipts` is already defined in `src/lib/tiers.ts` for `small_business` and above. This is exactly right for our use case. **No changes needed to tiers.ts** — the API routes already gate on `capture_bills_receipts`.

Verify this is correct:
- [ ] **Step 1: Confirm `capture_bills_receipts` in tiers.ts gates to small_business+**

```bash
grep -A2 "capture_bills_receipts" /opt/relentify-monorepo/apps/22accounting/src/lib/tiers.ts
```

Expected: `['small_business', 'medium_business', 'corporate']`

---

## Chunk 6: Deploy

### Task 10: Build and deploy

- [ ] **Step 1: Add env vars to `.env`**

Ensure these four vars are in `/opt/relentify-monorepo/apps/22accounting/.env`:
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=relentify-attachments
```

- [ ] **Step 2: Install SDK packages**

```bash
cd /opt/relentify-monorepo
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --filter accounting
pnpm install
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

1. Log in as a `small_business` user
2. Open a bill detail page → "Attach Receipt" button appears at bottom
3. Upload a JPEG → thumbnail/link appears
4. Click the link → presigned URL opens file in new tab
5. Click ✕ → file removed
6. Open expenses page → each row has a 📎 button
7. Click 📎 → panel expands with "Attach Receipt" button
8. Upload PDF → appears in list

---

## Update CLAUDE.md After Completion

When all tasks are done, update the CLAUDE.md checklist:
- Change `Priority 4 | 🔴` to `Priority 4 | ✅`
- Add migration 020 to the "Migrations applied" line in GL/COA section
- Add `src/lib/r2.ts` and `src/lib/attachment.service.ts` to Key Files table
- Add R2 env vars to the existing env var notes

---

## Summary of Files

| Action | File |
|--------|------|
| Create | `database/migrations/020_attachments.sql` |
| Create | `src/lib/r2.ts` |
| Create | `src/lib/attachment.service.ts` |
| Create | `app/api/attachments/route.ts` |
| Create | `app/api/attachments/[id]/route.ts` |
| Create | `src/components/Attachments.tsx` |
| Modify | `app/dashboard/bills/[id]/page.tsx` |
| Modify | `app/dashboard/expenses/page.tsx` |
| Modify | `app/dashboard/banking/page.tsx` |
