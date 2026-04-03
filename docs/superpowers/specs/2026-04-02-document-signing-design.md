# E-Sign Document Signing — Design Spec

## Summary

Upgrade 27sign from a text-confirmation signing tool to a full document signing service. Users upload PDFs or Word docs, place signature/initials/date/text fields on specific locations on specific pages, add one or more signers, and send. Signers see the document rendered as a scrollable webpage with interactive field overlays. After all fields are completed, a signed PDF is generated with all signatures composited at the correct positions and emailed to all parties.

## Goals

- Users can upload PDF or Word documents
- Sender places fields (signature, initials, date, free text) at precise locations on document pages via drag-and-drop
- Sender chooses who signs: single signer, multiple parallel, or multiple sequential
- Signer sees document as a webpage with clickable field overlays (not a raw PDF)
- Signed PDF generated server-side with all field values composited onto the original
- Signed PDF + Certificate of Completion auto-emailed to all signers and the sender
- Available via UI (dashboard) and API (programmatic integration)
- Saved signatures reused by email (already built)

## Non-goals (v1)

- PDF annotation / markup beyond placed fields
- Template library (pre-built field layouts for common documents)
- In-person signing (QR code at property viewing)
- Mobile app / PWA
- Batch sending (same doc to 50 signers)
- External conversion service (LibreOffice in-container is sufficient for initial volume)

---

## Architecture

### Sender flow

1. Log in → "New Request" → upload PDF or .docx
2. Word docs auto-converted to PDF via LibreOffice headless (async with retry — up to 3 attempts, 30s timeout each)
3. PDF stored as base64 in `documents` table; page count + per-page dimensions extracted
4. PDF pages rendered **client-side only** via `pdfjs-dist` as canvas images (no server-side page rendering)
5. Sender drags field types onto pages: Signature, Initials, Date, Text — with snap-to-grid for alignment
6. Optional: "Detect Fields" button scans PDF text for "Signature", "Date", "Sign here", "Print Name" and auto-suggests field placements
7. Each field assigned to a signer (colour-coded per signer)
8. Sender can pre-fill text/date fields via the UI (or API) — e.g. tenant name, property address
9. Sender adds signers by email/name, sets mode: single / parallel / sequential
10. Clicks "Send" → signing requests created, OTP emails dispatched

### Signer flow

1. Opens email link → lands on `/s/[token]`
2. Verifies email via 6-digit OTP → **short-lived signing session JWT issued (1 hour)** — subsequent API calls require this session token, not just the URL token
3. Sees document pages rendered as scrollable webpage (client-side pdfjs-dist, lazy-loaded — max 3 pages rendered at once, off-screen canvases unloaded)
4. Highlighted field boxes overlaid at placed positions; pre-filled fields shown as read-only
5. Clicks a field → modal opens:
   - Signature/Initials: signature pad (draw / upload / saved)
   - Date: date picker (defaults to today)
   - Text: text input with label
6. **Each field fill is individually audited** (IP, user agent, timestamp per field action)
7. Fields turn green when filled; progress indicator shows "3 of 5 fields completed"
8. "Finish Signing" button enabled when all assigned fields are filled
9. **"Decline to Sign"** button also available — signer enters optional reason, sender notified
10. Submit → field values stored → audit log + TSA timestamp

### Post-signing

1. **Sequential lock**: after each signer completes, their filled fields are locked (immutable). A snapshot hash is stored per signing step. Next signer cannot modify previous signers' fields.
2. If multi-signer sequential: next signer gets OTP email
3. When all signers complete:
   - **Document hash computed BEFORE compositing** (original PDF hash)
   - Server generates signed PDF via `pdf-lib` — signatures normalised to consistent DPI (150 DPI) before embedding
   - **Document hash computed AFTER compositing** (signed PDF hash)
   - Both hashes stored in audit log
   - Appends Certificate of Completion as final page
4. Signed PDF + CoC delivery:
   - Email contains **download link** (primary) — link valid for 30 days
   - PDFs under 2MB also **attached inline**; larger docs link-only (avoids spam filters)
   - Sent to all signers + the sender
5. Signed PDF downloadable from dashboard request detail page
6. **Webhook dispatched** with exponential backoff retry (3 attempts: immediate, +30s, +120s)

---

## Data Model

### New table: `documents`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| signing_request_id | UUID FK → signing_requests | |
| original_filename | VARCHAR(500) | |
| original_format | VARCHAR(10) | 'pdf' or 'docx' |
| pdf_data | TEXT | Base64 PDF (post-conversion) |
| page_count | INT | |
| page_dimensions | JSONB | Array of {width, height, rotation} per page (PDF points) |
| uploaded_at | TIMESTAMPTZ | |

### New table: `document_fields`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | UUID FK → documents | |
| signer_email | VARCHAR(255) | Which signer owns this field |
| field_type | VARCHAR(20) | 'signature', 'initials', 'date', 'text' |
| label | VARCHAR(255) | Optional (e.g. "Print Name", "Guarantor Signature") |
| page_number | INT | 1-indexed |
| x_percent | DECIMAL | X position as % of page width (0-100) |
| y_percent | DECIMAL | Y position as % of page height (0-100) |
| width_percent | DECIMAL | Field width as % of page width |
| height_percent | DECIMAL | Field height as % of page height |
| value | TEXT | Filled by signer: base64 for sig/initials, ISO date, or free text |
| prefilled | BOOLEAN DEFAULT FALSE | TRUE if sender pre-populated this field |
| aspect_ratio_locked | BOOLEAN DEFAULT TRUE | Lock aspect ratio for signature/initials fields |
| filled_at | TIMESTAMPTZ | NULL until filled |

Coordinates stored as percentages for resolution independence. Combined with `page_dimensions` from the documents table, these can be precisely converted to PDF points for compositing.

### New table: `signing_request_signers`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| signing_request_id | UUID FK → signing_requests | |
| email | VARCHAR(255) | |
| name | VARCHAR(255) | |
| token | VARCHAR(64) | Unique signing token for this signer |
| sign_order | INT | 1, 2, 3... (all same for parallel) |
| status | VARCHAR(20) | 'pending', 'sent', 'signed', 'declined' |
| decline_reason | TEXT | Optional reason if declined |
| signature_id | UUID FK → signatures | Saved signature used |
| snapshot_hash | VARCHAR(64) | Hash of document state after this signer completes |
| signed_at | TIMESTAMPTZ | |
| signed_ip | VARCHAR(45) | |

### Modified: `signing_requests`

Add columns:
- `signing_mode` VARCHAR(20) DEFAULT 'single' — 'single', 'parallel', 'sequential'
- `document_id` UUID FK → documents (nullable for legacy text-only requests)
- `all_signed` BOOLEAN DEFAULT FALSE — true when all signers complete
- `signed_pdf_data` TEXT — base64 of the final composited PDF
- `pre_sign_hash` VARCHAR(64) — SHA-256 of original PDF before any signing
- `post_sign_hash` VARCHAR(64) — SHA-256 of final signed PDF

Legacy text-only requests (from 23inventory API without document) continue to work unchanged. The `body_text` field remains for the legal attestation text shown alongside the document.

---

## Libraries

| Library | Purpose | License | Install |
|---------|---------|---------|---------|
| pdfjs-dist | Client-side PDF page rendering to canvas | Apache 2.0 | `pnpm add pdfjs-dist` |
| pdf-lib | Server-side PDF modification (composite signatures) | MIT | `pnpm add pdf-lib` |
| libreoffice-core | Word→PDF conversion | LGPL | `apk add libreoffice-core` in Dockerfile |

---

## API Changes

### New routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/documents/upload` | JWT | Upload PDF/Word, convert (async retry), store, return doc ID + page count + dimensions |
| GET | `/api/documents/[id]/pdf` | JWT or session | Serve raw PDF base64 for client-side pdfjs-dist rendering |
| POST | `/api/documents/[id]/fields` | JWT | Save field placements (batch array) |
| GET | `/api/documents/[id]/fields` | JWT or session | Get all fields |
| POST | `/api/documents/[id]/detect-fields` | JWT | Auto-detect signature/date/name placeholders in PDF text |
| POST | `/api/sign/[token]/fill-field` | Session | Signer fills one field (individually audited) |
| GET | `/api/sign/[token]/document` | Session | Get PDF base64 + signer's fields for client-side rendering |
| POST | `/api/sign/[token]/decline` | Session | Signer declines to sign (optional reason) |
| GET | `/api/documents/[id]/signed-pdf` | JWT | Download final signed PDF |
| POST | `/api/sign/[token]/resend-otp` | Public | Resend OTP email to signer |
| POST | `/api/v1/requests/[id]/resend` | API key | Resend signing email to a signer |
| POST | `/api/v1/requests/[id]/remind` | API key | Send reminder to pending signers |

**Removed**: `/api/documents/[id]/page/[num]` — all page rendering is client-side via pdfjs-dist. No server-side PNG generation.

**Session auth**: After OTP verification, a short-lived JWT (1 hour) is issued. All signer-side API calls require this session token in an `Authorization: Bearer` header. The URL token alone is not sufficient after initial OTP step.

### Modified routes

| Route | Change |
|-------|--------|
| `POST /api/v1/requests` | Accept multipart: file upload + signers + fields in one call |
| `POST /api/requests/create` | Accept file upload + signers + fields from UI |
| `POST /api/sign/[token]/complete` | Now marks individual signer as done; triggers next signer or PDF generation |
| `GET /api/sign/[token]` | Returns document info alongside existing signing data |

---

## UI Components

### Sender side (new/rewritten)

**`/requests/new` page** — rewrite as multi-step wizard:
1. **Upload step**: drag-and-drop file upload (PDF/Word), shows upload progress
2. **Place fields step**: document viewer with drag-and-drop field toolbar
3. **Add signers step**: email/name inputs, colour assignment, parallel/sequential toggle
4. **Review & send step**: summary of document, fields, signers → "Send" button

**`DocumentViewer.tsx`** — renders PDF pages as scrollable canvas images via pdfjs-dist. Handles zoom and responsive sizing.

**`FieldPlacer.tsx`** — overlay on DocumentViewer. Toolbar with field types (Signature, Initials, Date, Text). Click a tool → click on the page to place it. Drag to reposition, drag corners to resize (aspect ratio locked for signature/initials). Click to edit label. Each field colour-coded to assigned signer. Light snap-to-grid for alignment. "Detect Fields" button for auto-placement suggestions.

**`SignerManager.tsx`** — add/remove signers, assign display colours, toggle parallel/sequential, drag to reorder.

### Signer side (rewrite `/s/[token]`)

After OTP verification, replace the current text-only view:

**`DocumentSigner.tsx`** — renders document pages with interactive field overlays. Scrollable. Fields highlighted in the signer's colour. Click a field → opens:
- Signature/Initials: existing SignatureCapture component (draw/upload/saved)
- Date: date input (defaults to today)
- Text: text input with placeholder from field label

Progress bar: "3 of 5 fields completed"
"Finish Signing" button at bottom (disabled until all fields filled)

### Shared

**`PageRenderer.tsx`** — wraps pdfjs-dist canvas rendering. Used by both DocumentViewer (sender) and DocumentSigner (signer). Renders one page at a time. **Performance**: lazy loads pages (max 3 rendered at once), unloads off-screen canvases, virtual scrolling for 50+ page documents.

---

## Document Storage

- PDFs stored as base64 in PostgreSQL TEXT column (`documents.pdf_data`)
- Typical size: 100KB–2MB per document (tenancy agreements, inventories)
- Matches existing pattern (23inventory photos use base64)
- Page images rendered on-demand via pdfjs-dist (client) or server-side (API)
- Signed PDFs also stored as base64 (`signing_requests.signed_pdf_data`)
- Migration to S3 later if volume demands it

---

## Word Conversion

- LibreOffice headless added to Docker image: `apk add --no-cache libreoffice-core font-noto`
- On upload of `.docx`: `libreoffice --headless --convert-to pdf --outdir /tmp <file>`
- Original Word file discarded after conversion; only PDF stored
- **Async with retry**: up to 3 attempts, 30s timeout each. LibreOffice headless can fail randomly under load.
- If all attempts fail: return 400 with "Could not convert document — try uploading as PDF"
- Conversion typically takes 1-3 seconds per document

---

## Signed PDF Generation (pdf-lib)

After all signers complete:

1. Load original PDF from `documents.pdf_data`
2. For each filled `document_field`:
   - Signature/Initials: embed base64 PNG image at (x, y, width, height) on the page
   - Date: draw text at position using standard font
   - Text: draw text at position using standard font
3. Append a final page: Certificate of Completion (audit trail, hashes, legal text)
4. Save modified PDF → store as `signing_requests.signed_pdf_data`
5. Email to all signers + sender via Resend

Coordinate conversion: field positions are stored as percentages. pdf-lib uses points (72 per inch). Convert using per-page dimensions from `documents.page_dimensions`: `x_points = (x_percent / 100) * page_width_points`.

**Signature normalisation**: all signature/initials images normalised to 150 DPI before embedding. Stored originals are high-res; scaled at render time to prevent blurry or stretched signatures across different field sizes.

---

## Multi-Signer Logic

### Single mode (default)
- One signer, one token
- Complete → generate signed PDF → email both parties

### Parallel mode
- Multiple signers, each gets their own token + OTP email immediately
- Each signer sees only their assigned fields
- `all_signed` set to TRUE when last signer completes
- Signed PDF generated after all complete

### Sequential mode
- Multiple signers with `sign_order` 1, 2, 3...
- Only signer #1 gets OTP email initially
- When signer #1 completes: signer #2 gets email
- Continue until all complete → generate signed PDF

Status tracking per signer in `signing_request_signers` table. Webhook fires only when `all_signed = TRUE`.

---

## Email Notifications

| Event | Recipients | Content |
|-------|-----------|---------|
| Request created | Each signer (respecting order) | "You have a document to sign" + link |
| Signer completes | Sender | "[Name] has signed [doc title]" |
| Signer declines | Sender | "[Name] declined to sign [doc title]" + reason |
| All complete | All signers + sender | Download link + inline attachment if <2MB |
| Sequential next | Next signer in order | "Your turn to sign [doc title]" |
| Reminder (auto) | Pending signers | "Reminder: [doc title] awaits your signature" |
| Resend (manual) | Specific signer | Re-sends original signing email |

**Delivery strategy**: signed PDF sent as download link (primary). Inline attachment only for PDFs under 2MB. This avoids spam filter issues with large attachments.

**Auto-chase reminders**: configurable per request. Default: send reminder after 48h if still pending. Sender can disable or adjust timing.

---

## API Integration (Programmatic)

External apps send a single multipart POST:

```
POST /api/v1/requests
Authorization: Bearer rs_live_...
Content-Type: multipart/form-data

file: <PDF binary>
title: "Tenancy Agreement — 14 Oak Lane"
bodyText: "Legal attestation paragraph"
signingMode: "single"
signers: [{"email": "tenant@example.com", "name": "Jane Doe"}]
fields: [
  {"signerEmail": "tenant@example.com", "type": "signature", "page": 1, "x": 60, "y": 85, "width": 30, "height": 8},
  {"signerEmail": "tenant@example.com", "type": "date", "page": 1, "x": 60, "y": 93, "width": 20, "height": 4}
]
callbackUrl: "https://..."
callbackSecret: "whsec_..."
```

Response includes signing URLs per signer. Legacy text-only requests (no file) continue to work.

---

## Backwards Compatibility

- Existing text-only signing requests (23inventory integration) continue to work unchanged
- `document_id` is nullable on `signing_requests` — text-only requests have no document
- The current `/s/[token]` page detects whether a document exists and renders accordingly:
  - With document: full document viewer + field overlays
  - Without document: existing text + signature pad flow
- Existing MCP tests (25/25) must continue passing
- New MCP tests added for document flow

---

## Security

- Uploaded documents only accessible to: the sender (JWT auth) and assigned signers (session auth after OTP)
- **Session tokens**: after OTP verification, a short-lived JWT (1 hour) is issued. All signer API calls require this session token. URL token alone is insufficient after OTP step — mitigates token leakage risk.
- **Token rotation**: after OTP verification, the URL token is consumed. A new session-scoped token is returned. The original URL token cannot be reused to bypass OTP.
- File upload limited to 10MB per document
- Only `.pdf` and `.docx` accepted (MIME type + extension check)
- LibreOffice runs in sandboxed container (no network, limited resources)
- **Per-field audit**: every field fill action logged with IP, user agent, timestamp — not just the final submit
- **Document integrity hashes**: SHA-256 of original PDF before signing (`pre_sign_hash`) and after compositing (`post_sign_hash`) — both stored in audit log
- **Sequential signing locks**: after each signer completes, their fields are immutable. Snapshot hash stored per signing step.
- Signed PDF includes all existing security: hash-chained audit, OTP verification, TSA timestamp
- **Webhook retry**: 3 attempts with exponential backoff (immediate, +30s, +120s). Failed attempts logged in audit.

## Auto-Detect Fields

Basic text scanning of PDF content to suggest field placements:

- Scan for keywords: "Signature", "Sign here", "Signed", "Date", "Print Name", "Initials"
- Use pdfjs-dist text layer extraction (client-side) or pdf-lib text extraction (server-side for API)
- Return suggested field positions (page, approximate coordinates)
- Sender reviews and adjusts — suggestions are not auto-applied
- Even basic regex matching significantly improves UX for standard contracts

## Pre-Fill Fields

Sender (or API caller) can pre-populate text and date fields before sending:

- `prefilled: true` flag on `document_fields` — signer sees these as read-only
- Common use: tenant name, property address, agreement date, landlord name
- API example: `{"type": "text", "label": "Tenant Name", "value": "Jane Doe", "prefilled": true}`
- Reduces signer friction — they only need to sign/initial, not type information the sender already has
