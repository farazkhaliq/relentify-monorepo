# Document Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 27sign from text-only confirmation signing to a full document signing service with PDF/Word upload, drag-and-drop field placement, multi-signer support, and signed PDF generation.

**Architecture:** Client-side PDF rendering via pdfjs-dist, server-side PDF compositing via pdf-lib, Word→PDF conversion via LibreOffice headless. Multi-signer with per-signer OTP + session JWT. Hash-chained audit with per-field logging. Webhook retry with exponential backoff.

**Tech Stack:** Next.js 15, pdfjs-dist, pdf-lib, LibreOffice headless, PostgreSQL (raw pg), signature_pad, Resend email

**Spec:** `docs/superpowers/specs/2026-04-02-document-signing-design.md`

---

## Phase Overview

| Phase | What | Depends On | Days |
|-------|------|-----------|------|
| 1 | Database schema migration | — | 0.5 |
| 2 | Document upload + Word conversion | 1 | 2 |
| 3 | Session tokens + multi-signer data model | 1 | 2 |
| 4 | PDF rendering + field placement UI | 2, 3 | 5 |
| 5 | Signed PDF generation (pdf-lib compositing) | 4 | 2 |
| 6 | Email delivery + webhook retry | 3 | 1.5 |
| 7 | Sequential locks, auto-detect, pre-fill, polish | 4, 5 | 2 |

**Total: ~15 working days**

Phases 2 and 3 can run in parallel. Phase 6 can start alongside Phase 4.

---

## File Structure (new/modified files)

### New files

```
apps/27sign/
  migrations/
    002-document-signing.sql

  src/lib/
    document.ts              # Upload, convert, extract dimensions
    signers.ts               # Multi-signer CRUD + orchestration
    signer-session.ts        # JWT session tokens for signers
    pdf-composer.ts          # Composite signed PDF via pdf-lib
    document-hash.ts         # SHA-256 pre/post signing hashes
    email-templates.ts       # HTML email builders
    email.ts                 # Send email wrapper (Resend)

  src/components/
    PageRenderer.tsx         # pdfjs-dist single page canvas (lazy)
    DocumentViewer.tsx       # Scrollable multi-page viewer
    FieldPlacer.tsx          # Drag-and-drop field overlay (sender)
    FieldModal.tsx           # Modal for filling a field (signer)
    SignerManager.tsx         # Add/remove/reorder signers
    DocumentSigner.tsx       # Signer document view + field overlays
    FileUpload.tsx           # Drag-and-drop file upload zone
    RequestWizard.tsx        # Multi-step new request wizard

  app/api/
    documents/upload/route.ts
    documents/[id]/pdf/route.ts
    documents/[id]/fields/route.ts
    documents/[id]/detect-fields/route.ts
    documents/[id]/signed-pdf/route.ts
    sign/[token]/fill-field/route.ts
    sign/[token]/document/route.ts
    sign/[token]/decline/route.ts
    sign/[token]/resend-otp/route.ts
    v1/requests/[id]/resend/route.ts
    v1/requests/[id]/remind/route.ts
```

### Modified files

```
  Dockerfile                                    # Add libreoffice-core + fonts
  package.json                                  # Add pdfjs-dist, pdf-lib
  src/lib/webhook.ts                            # Add retry with exponential backoff
  src/lib/audit.ts                              # Add per-field action types
  app/api/v1/requests/route.ts                  # Accept multipart + signers + fields
  app/api/sign/[token]/route.ts                 # Return document info + trigger OTP per signer
  app/api/sign/[token]/verify-email/route.ts    # Issue session JWT after OTP
  app/api/sign/[token]/complete/route.ts        # Per-signer completion + PDF generation trigger
  app/(public)/s/[token]/SigningClient.tsx       # Branch: document vs text-only
  app/(main)/requests/new/page.tsx              # Rewrite as wizard
  app/(main)/requests/[id]/page.tsx             # Show document info, signers, download
  app/(main)/page.tsx                           # Show signing mode, signer progress
```

---

## Phase 1: Database Schema Migration

**Files:**
- Create: `apps/27sign/migrations/002-document-signing.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 002-document-signing.sql
-- Run: docker exec infra-postgres psql -U relentify_user -d esign -f -

BEGIN;

-- New table: documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signing_request_id UUID REFERENCES signing_requests(id),
  original_filename VARCHAR(500) NOT NULL,
  original_format VARCHAR(10) NOT NULL,
  pdf_data TEXT NOT NULL,
  page_count INT NOT NULL,
  page_dimensions JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_request ON documents(signing_request_id);

-- New table: document_fields
CREATE TABLE document_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  signer_email VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL,
  label VARCHAR(255),
  page_number INT NOT NULL,
  x_percent DECIMAL NOT NULL,
  y_percent DECIMAL NOT NULL,
  width_percent DECIMAL NOT NULL,
  height_percent DECIMAL NOT NULL,
  value TEXT,
  prefilled BOOLEAN DEFAULT FALSE,
  aspect_ratio_locked BOOLEAN DEFAULT TRUE,
  filled_at TIMESTAMPTZ
);
CREATE INDEX idx_doc_fields_doc ON document_fields(document_id);
CREATE INDEX idx_doc_fields_signer ON document_fields(document_id, signer_email);

-- New table: signing_request_signers
CREATE TABLE signing_request_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signing_request_id UUID NOT NULL REFERENCES signing_requests(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  token VARCHAR(64) UNIQUE,
  sign_order INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decline_reason TEXT,
  signature_id UUID REFERENCES signatures(id),
  snapshot_hash VARCHAR(64),
  signed_at TIMESTAMPTZ,
  signed_ip VARCHAR(45)
);
CREATE INDEX idx_signers_request ON signing_request_signers(signing_request_id);
CREATE INDEX idx_signers_token ON signing_request_signers(token);

-- Alter signing_requests for document support
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signing_mode VARCHAR(20) DEFAULT 'single';
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id);
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS all_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signed_pdf_data TEXT;
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS pre_sign_hash VARCHAR(64);
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS post_sign_hash VARCHAR(64);
ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS reminder_interval_hours INT DEFAULT 48;

COMMIT;
```

- [ ] **Step 2: Run the migration**

```bash
docker exec infra-postgres psql -U relentify_user -d esign -c "$(cat /opt/relentify-monorepo/apps/27sign/migrations/002-document-signing.sql)"
```

Expected: All CREATE TABLE and ALTER TABLE succeed.

- [ ] **Step 3: Verify existing MCP tests still pass**

```bash
cd /opt/infra/mcp/27sign-mcp && source venv/bin/activate && python3 run_tests.py
```

Expected: 25/25 passed (all existing tests unaffected by additive schema changes)

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/27sign/migrations/002-document-signing.sql
git commit -m "feat(27sign): add document signing schema — documents, document_fields, signing_request_signers tables"
```

---

## Phase 2: Document Upload + Word Conversion

### Task 2.1: Add pdf-lib dependency and update Dockerfile

**Files:**
- Modify: `apps/27sign/package.json`
- Modify: `apps/27sign/Dockerfile`

- [ ] **Step 1: Add pdf-lib and pdfjs-dist to package.json**

```bash
cd /opt/relentify-monorepo && pnpm add pdf-lib pdfjs-dist --filter sign
```

- [ ] **Step 2: Update Dockerfile to add LibreOffice**

In `apps/27sign/Dockerfile`, add to the runner stage (before `USER nextjs`):

```dockerfile
# After: RUN apk add --no-cache openssl
RUN apk add --no-cache openssl libreoffice-core font-noto
```

- [ ] **Step 3: Test Docker build compiles**

```bash
cd /opt/relentify-monorepo && docker compose -f apps/27sign/docker-compose.yml build --no-cache 2>&1 | tail -5
```

Expected: Build succeeds. Image will be larger (~80MB more).

- [ ] **Step 4: Commit**

```bash
git add apps/27sign/package.json apps/27sign/Dockerfile pnpm-lock.yaml
git commit -m "feat(27sign): add pdf-lib, pdfjs-dist deps + LibreOffice in Dockerfile"
```

### Task 2.2: Document upload library

**Files:**
- Create: `apps/27sign/src/lib/document.ts`

- [ ] **Step 1: Write the document upload/conversion module**

```typescript
// apps/27sign/src/lib/document.ts
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { PDFDocument } from 'pdf-lib'
import { query } from './db'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const ALLOWED_EXTENSIONS = ['.pdf', '.docx']

// Simple semaphore to limit concurrent LibreOffice conversions (RAM constraint)
let converting = false

interface UploadResult {
  documentId: string
  pageCount: number
  pageDimensions: Array<{ width: number; height: number; rotation: number }>
}

export async function uploadDocument(
  file: Buffer,
  filename: string,
  mimeType: string,
  signingRequestId: string
): Promise<UploadResult> {
  // Validate size
  if (file.length > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB)')
  }

  // Validate type
  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Only .pdf and .docx files are accepted')
  }

  let pdfBuffer: Buffer
  const isWord = ext === '.docx'

  if (isWord) {
    pdfBuffer = await convertWordToPdf(file, filename)
  } else {
    pdfBuffer = file
  }

  // Extract page info via pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const pageCount = pdfDoc.getPageCount()
  const pageDimensions = pdfDoc.getPages().map(page => {
    const { width, height } = page.getSize()
    const rotation = page.getRotation().angle
    return { width, height, rotation }
  })

  // Store as base64
  const pdfBase64 = pdfBuffer.toString('base64')

  const { rows } = await query(
    `INSERT INTO documents (signing_request_id, original_filename, original_format, pdf_data, page_count, page_dimensions)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [signingRequestId, filename, isWord ? 'docx' : 'pdf', pdfBase64, pageCount, JSON.stringify(pageDimensions)]
  )

  // Link document to signing request
  await query('UPDATE signing_requests SET document_id = $1 WHERE id = $2', [rows[0].id, signingRequestId])

  return { documentId: rows[0].id, pageCount, pageDimensions }
}

async function convertWordToPdf(fileBuffer: Buffer, filename: string): Promise<Buffer> {
  // Wait for any ongoing conversion (simple semaphore for RAM safety)
  const maxWait = 60000
  const start = Date.now()
  while (converting && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 500))
  }

  converting = true
  const tmpId = randomBytes(8).toString('hex')
  const inputPath = `/tmp/convert-${tmpId}.docx`
  const outputDir = `/tmp/convert-${tmpId}`

  try {
    writeFileSync(inputPath, fileBuffer)

    // Retry up to 3 times
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        execSync(`mkdir -p ${outputDir} && libreoffice --headless --convert-to pdf --outdir ${outputDir} ${inputPath}`, {
          timeout: 30000,
          stdio: 'pipe',
        })

        const outputPath = path.join(outputDir, path.basename(inputPath, '.docx') + '.pdf')
        if (!existsSync(outputPath)) {
          throw new Error('Conversion produced no output')
        }

        return readFileSync(outputPath)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000))
      }
    }

    throw new Error(`Word conversion failed after 3 attempts: ${lastError?.message}`)
  } finally {
    converting = false
    // Cleanup temp files
    try { unlinkSync(inputPath) } catch {}
    try { execSync(`rm -rf ${outputDir}`, { stdio: 'pipe' }) } catch {}
  }
}

export async function getDocumentPdf(documentId: string): Promise<string | null> {
  const { rows } = await query('SELECT pdf_data FROM documents WHERE id = $1', [documentId])
  return rows.length > 0 ? rows[0].pdf_data : null
}

export async function getDocumentInfo(documentId: string) {
  const { rows } = await query(
    'SELECT id, original_filename, original_format, page_count, page_dimensions, uploaded_at FROM documents WHERE id = $1',
    [documentId]
  )
  return rows.length > 0 ? rows[0] : null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/27sign/src/lib/document.ts
git commit -m "feat(27sign): document upload + Word→PDF conversion with retry"
```

### Task 2.3: Upload API route

**Files:**
- Create: `apps/27sign/app/api/documents/upload/route.ts`
- Create: `apps/27sign/app/api/documents/[id]/pdf/route.ts`

- [ ] **Step 1: Write the upload route**

```typescript
// apps/27sign/app/api/documents/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { uploadDocument } from '@/lib/document'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const signingRequestId = formData.get('signingRequestId') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!signingRequestId) return NextResponse.json({ error: 'signingRequestId required' }, { status: 400 })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadDocument(buffer, file.name, file.type, signingRequestId)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Write the PDF serve route**

```typescript
// apps/27sign/app/api/documents/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDocumentPdf } from '@/lib/document'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const pdfBase64 = await getDocumentPdf(id)
  if (!pdfBase64) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ pdf: pdfBase64 })
}
```

- [ ] **Step 3: Test with curl**

```bash
# Create a signing request first
curl -s -X POST http://localhost:3027/api/v1/requests \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signerEmail":"test@example.com","title":"Test","bodyText":"Test body"}' | jq .id

# Upload a PDF (replace REQUEST_ID)
curl -s -X POST http://localhost:3027/api/documents/upload \
  -H "Cookie: relentify_token=$JWT" \
  -F "file=@test.pdf" \
  -F "signingRequestId=REQUEST_ID" | jq .
```

Expected: `{ documentId, pageCount, pageDimensions }` with 201 status.

- [ ] **Step 4: Commit**

```bash
git add apps/27sign/app/api/documents/
git commit -m "feat(27sign): document upload + PDF serve API routes"
```

---

## Phase 3: Session Tokens + Multi-Signer

### Task 3.1: Signer session JWT module

**Files:**
- Create: `apps/27sign/src/lib/signer-session.ts`

- [ ] **Step 1: Write the session module**

```typescript
// apps/27sign/src/lib/signer-session.ts
import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-dev-secret')
const SESSION_DURATION = '1h'

interface SignerSessionPayload {
  signerEmail: string
  signingRequestId: string
  signerId: string
  type: 'signer_session'
}

export async function createSignerSession(
  signerEmail: string,
  signingRequestId: string,
  signerId: string
): Promise<string> {
  return new SignJWT({
    signerEmail,
    signingRequestId,
    signerId,
    type: 'signer_session',
  } as SignerSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(SECRET)
}

export async function verifySignerSession(req: NextRequest): Promise<SignerSessionPayload | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)

  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.type !== 'signer_session') return null
    return payload as unknown as SignerSessionPayload
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/27sign/src/lib/signer-session.ts
git commit -m "feat(27sign): signer session JWT — 1-hour sessions after OTP"
```

### Task 3.2: Multi-signer CRUD module

**Files:**
- Create: `apps/27sign/src/lib/signers.ts`

- [ ] **Step 1: Write the signers module**

```typescript
// apps/27sign/src/lib/signers.ts
import { query } from './db'
import { generateToken } from './tokens'

interface SignerInput {
  email: string
  name?: string
  signOrder?: number
}

export async function createSigners(
  signingRequestId: string,
  signers: SignerInput[]
): Promise<Array<{ id: string; email: string; token: string }>> {
  const results = []
  for (const signer of signers) {
    const token = generateToken()
    const { rows } = await query(
      `INSERT INTO signing_request_signers (signing_request_id, email, name, token, sign_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, token`,
      [signingRequestId, signer.email.toLowerCase().trim(), signer.name || null, token, signer.signOrder || 1]
    )
    results.push(rows[0])
  }
  return results
}

export async function getSignersForRequest(signingRequestId: string) {
  const { rows } = await query(
    'SELECT * FROM signing_request_signers WHERE signing_request_id = $1 ORDER BY sign_order ASC',
    [signingRequestId]
  )
  return rows
}

export async function getSignerByToken(token: string) {
  const { rows } = await query(
    `SELECT srs.*, sr.id as request_id, sr.document_id, sr.signing_mode, sr.title, sr.body_text
     FROM signing_request_signers srs
     JOIN signing_requests sr ON srs.signing_request_id = sr.id
     WHERE srs.token = $1`,
    [token]
  )
  return rows.length > 0 ? rows[0] : null
}

export async function markSignerComplete(
  signerId: string,
  ip: string | null,
  snapshotHash: string
) {
  await query(
    `UPDATE signing_request_signers
     SET status = 'signed', signed_at = NOW(), signed_ip = $2, snapshot_hash = $3
     WHERE id = $1`,
    [signerId, ip, snapshotHash]
  )
}

export async function markSignerDeclined(signerId: string, reason: string | null) {
  await query(
    `UPDATE signing_request_signers SET status = 'declined', decline_reason = $2 WHERE id = $1`,
    [signerId, reason]
  )
}

export async function areAllSignersComplete(signingRequestId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE status IN ('signed', 'declined')) as done
     FROM signing_request_signers WHERE signing_request_id = $1`,
    [signingRequestId]
  )
  return rows[0].total > 0 && rows[0].total === rows[0].done
}

export async function getNextPendingSigner(signingRequestId: string) {
  const { rows } = await query(
    `SELECT * FROM signing_request_signers
     WHERE signing_request_id = $1 AND status = 'pending'
     ORDER BY sign_order ASC LIMIT 1`,
    [signingRequestId]
  )
  return rows.length > 0 ? rows[0] : null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/27sign/src/lib/signers.ts
git commit -m "feat(27sign): multi-signer CRUD — create, track, complete, decline"
```

### Task 3.3: Update OTP verify to issue session token

**Files:**
- Modify: `apps/27sign/app/api/sign/[token]/verify-email/route.ts`

- [ ] **Step 1: Modify the verify route to return a session JWT**

Add import for `createSignerSession` and `getSignerByToken`. After successful OTP verification, look up the signer record and create a session JWT. Return it alongside `verified: true`.

Key changes to the existing file:
- Import `createSignerSession` from `@/lib/signer-session`
- Import `getSignerByToken` from `@/lib/signers`
- After `verifyOtp()` returns `valid: true`:
  - Look up signer: `const signer = await getSignerByToken(token)`
  - If signer exists (document flow): `const sessionToken = await createSignerSession(signer.email, signer.signing_request_id, signer.id)`
  - Return: `{ verified: true, sessionToken }`
  - If no signer (legacy text-only flow): return `{ verified: true }` (no session token — backwards compat)

- [ ] **Step 2: Verify existing MCP tests still pass**

```bash
cd /opt/infra/mcp/27sign-mcp && source venv/bin/activate && python3 run_tests.py
```

Expected: 25/25 passed. Legacy flow unchanged because `getSignerByToken` returns null for text-only requests.

- [ ] **Step 3: Commit**

```bash
git add apps/27sign/app/api/sign/[token]/verify-email/route.ts
git commit -m "feat(27sign): issue signer session JWT after OTP verification"
```

---

## Phase 4: PDF Rendering + Field Placement UI

> This is the largest phase (~5 days). Detailed step-by-step code will be written during execution as it depends on patterns validated in Phases 2-3.

### Task 4.1: PageRenderer component (pdfjs-dist wrapper)

**Files:** Create `src/components/PageRenderer.tsx`

Client component wrapping pdfjs-dist. Renders a single PDF page to canvas. Props: `pdfData` (base64), `pageNumber`, `scale`. Uses IntersectionObserver for lazy rendering. Max 3 pages rendered simultaneously. Must use `next/dynamic` with `{ ssr: false }` to avoid server-side canvas errors. pdfjs worker loaded from `/pdf.worker.min.mjs` (copy to `public/` during build).

### Task 4.2: DocumentViewer component

**Files:** Create `src/components/DocumentViewer.tsx`

Scrollable container rendering all pages via PageRenderer. Zoom controls. Page number indicators. Used by both sender (field placement) and signer (document viewing).

### Task 4.3: FieldPlacer component (sender-side)

**Files:** Create `src/components/FieldPlacer.tsx`, `src/components/FieldToolbar.tsx`

Overlay on DocumentViewer. Toolbar with field types (Signature, Initials, Date, Text). Click tool → click page to place. Drag to reposition (pointer events). Drag corners to resize (aspect ratio locked for sig/initials). Snap-to-grid (1% increments). Colour-coded per signer. "Detect Fields" button.

### Task 4.4: SignerManager component

**Files:** Create `src/components/SignerManager.tsx`

Add signers by email/name. Assign colours. Toggle parallel/sequential. Drag to reorder for sequential. Pre-fill field values for text/date fields.

### Task 4.5: Request wizard page rewrite

**Files:** Rewrite `app/(main)/requests/new/page.tsx`, create `src/components/RequestWizard.tsx`, `src/components/FileUpload.tsx`

Multi-step wizard: Upload → Place Fields → Add Signers → Review & Send. The existing text-only form becomes a "Quick Request" tab (no document).

### Task 4.6: Field placement API routes

**Files:** Create `app/api/documents/[id]/fields/route.ts`

POST: save field placements (batch array). GET: retrieve all fields for a document. Both JWT auth.

### Task 4.7: DocumentSigner component (signer-side)

**Files:** Create `src/components/DocumentSigner.tsx`, `src/components/FieldModal.tsx`, `src/components/ProgressBar.tsx`

Signer document view. Renders pages with field overlays. Click field → modal opens (SignatureCapture for sig/initials, date picker, text input). Progress bar. "Finish Signing" + "Decline to Sign" buttons.

### Task 4.8: Signer document + field API routes

**Files:** Create `app/api/sign/[token]/document/route.ts`, `app/api/sign/[token]/fill-field/route.ts`, `app/api/sign/[token]/decline/route.ts`

Session auth on all. Per-field fill individually audited. Decline stores reason and notifies sender.

### Task 4.9: Update SigningClient to branch document vs text

**Files:** Modify `app/(public)/s/[token]/SigningClient.tsx`

After OTP: if signing request has `documentId`, render DocumentSigner. Otherwise render existing text + signature flow unchanged.

---

## Phase 5: Signed PDF Generation

### Task 5.1: PDF composer module

**Files:** Create `src/lib/pdf-composer.ts`, `src/lib/document-hash.ts`

Load original PDF via pdf-lib. Iterate filled fields. Embed signature PNGs (normalised to 150 DPI). Draw date/text with standard font. Coordinate conversion: `x_points = (x_percent / 100) * page_width`, `y_points = page_height - (y_percent / 100 * page_height) - field_height` (PDF origin is bottom-left). Append Certificate of Completion as final page.

### Task 5.2: Wire completion to PDF generation

**Files:** Modify `app/api/sign/[token]/complete/route.ts`

After marking signer complete: check `areAllSignersComplete()`. If true: compute pre-sign hash, call `compositeSignedPdf()`, compute post-sign hash, store signed PDF, trigger email + webhook.

### Task 5.3: Signed PDF download route

**Files:** Create `app/api/documents/[id]/signed-pdf/route.ts`

JWT auth. Returns signed PDF base64 for dashboard download.

---

## Phase 6: Email Delivery + Webhook Retry

### Task 6.1: Email templates + send wrapper

**Files:** Create `src/lib/email-templates.ts`, `src/lib/email.ts`

HTML templates for: signing invite, signer completed, signer declined, all completed (with download link + optional attachment <2MB), sequential next, reminder. Wraps Resend with download link generation.

### Task 6.2: Webhook retry with exponential backoff

**Files:** Modify `src/lib/webhook.ts`

3 attempts: immediate, +30s, +120s. Use setTimeout (in-process). Log each attempt in audit trail.

### Task 6.3: Resend + remind API routes

**Files:** Create `app/api/sign/[token]/resend-otp/route.ts`, `app/api/v1/requests/[id]/resend/route.ts`, `app/api/v1/requests/[id]/remind/route.ts`

---

## Phase 7: Sequential Locks, Auto-Detect, Pre-Fill, Polish

### Task 7.1: Sequential signing orchestration

After signer N completes: compute snapshot hash of all filled fields, lock their fields (fill-field endpoint rejects), email signer N+1.

### Task 7.2: Auto-detect fields

**Files:** Create `app/api/documents/[id]/detect-fields/route.ts`

Scan PDF text layer for "Signature", "Date", "Sign here", "Print Name". Return suggested positions.

### Task 7.3: Dashboard updates

Update request detail page with document info, per-signer status, download button. Update dashboard with signing mode badge and signer progress.

### Task 7.4: Final MCP test expansion

Add document upload, field placement, multi-signer, PDF generation, webhook retry to MCP test suite. Target: 40+ tests.

---

## Verification

After each phase:

1. **Run existing MCP tests**: `cd /opt/infra/mcp/27sign-mcp && source venv/bin/activate && python3 run_tests.py` — must remain 25/25
2. **Run 23inventory MCP tests**: `cd /opt/infra/mcp/23inventory-mcp && source venv/bin/activate && python3 run_tests.py` — must remain 20/20
3. **Docker build**: `docker compose -f apps/27sign/docker-compose.yml build --no-cache` — must succeed
4. **Health check**: `curl http://localhost:3027/api/health` — must return 200

End-to-end validation after Phase 5:
1. Upload a PDF via dashboard → place signature + date fields → add signer → send
2. Open signing URL → verify OTP → see document → fill fields → submit
3. Verify signed PDF generated with signatures at correct positions
4. Verify webhook fires with signed PDF data
5. Verify both parties receive email with download link
