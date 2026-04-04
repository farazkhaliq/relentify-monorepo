# Relentify Inventory (23inventory) — Claude Notes

## What this app does
Property inventory management for landlords and letting agents. Create check-in and check-out inventories, upload room-by-room photos with condition ratings, generate PDF reports, and send them to tenants for digital signing via the 27sign E-Sign service.

**URL:** https://inventory.relentify.com
**Container:** `23inventory` on port 3023
**Network:** `infra_default`
**Source:** `/opt/relentify-monorepo/apps/23inventory/`
**Database:** `relentify` on `infra-postgres` (shared DB, tables prefixed `inv_`)

---

## Tech stack
- Next.js 15 App Router (TypeScript)
- Raw `pg` Pool for database queries (migrated from Prisma — snake_case tables `inv_items`, `inv_photos`)
- PostgreSQL: `infra-postgres`, db: `relentify`, user: `relentify_user`
- Auth: shared JWT cookie (`relentify_token`) via `@relentify/auth`
- `pdf-lib` for server-side PDF report generation (sent to 27sign for signing)
- Photos stored as base64 in DB (S3 migration planned for scale)
- `@relentify/ui` for all UI components
- Resend for tenant emails
- 27sign integration for digital signatures

---

## Database schema

**Two tables** in the shared `relentify` database:

### inv_items
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | VARCHAR | Multi-tenancy key |
| property_address | VARCHAR | |
| type | VARCHAR | 'check-in' or 'check-out' |
| created_at | TIMESTAMPTZ | |
| created_by | VARCHAR | Agent name |
| notes | TEXT | |
| tenant_confirmed | BOOLEAN | Default false |
| confirmed_at | TIMESTAMPTZ | |
| confirmed_ip | VARCHAR | |
| confirm_token | VARCHAR UNIQUE | For public confirmation link |
| tenant_email | VARCHAR | |
| email_sent_at | TIMESTAMPTZ | |
| signing_request_id | VARCHAR | Links to 27sign signing request |
| tenant_signature_data | TEXT | Base64 PNG signature from 27sign |

### inv_photos
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| inventory_id | UUID FK | Cascade delete |
| room | VARCHAR | e.g. "Living Room" |
| description | TEXT | |
| condition | VARCHAR | "Good", "Fair", "Poor" |
| image_data | TEXT | Base64 JPEG |
| uploaded_at | TIMESTAMPTZ | |

---

## Key files
| File | Purpose |
|------|---------|
| `src/lib/db.ts` | pg Pool connection to relentify DB |
| `src/lib/auth.ts` | JWT cookie auth (`getAuthUser()`) |
| `src/lib/types.ts` | InventoryRow/Photo types + snake_case→camelCase mappers |
| `src/lib/pdf-report.ts` | Generate inventory PDF via pdf-lib (for 27sign) |
| `src/components/PhotoManager.tsx` | Room tabs + photo upload (main UI complexity) |
| `src/components/CopyConfirmLink.tsx` | Copy confirmation link + email tenant |
| `src/components/PrintButton.tsx` | Client-side print button for PDF report |
| `middleware.ts` | JWT auth; public: `/confirm/*`, `/api/confirm/*`, `/api/health`, `/api/webhooks/*` |
| `app/(main)/layout.tsx` | NavShell + TopBar layout |

---

## API Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/inventories` | GET | JWT | List user's inventories |
| `/api/inventories` | POST | JWT | Create inventory |
| `/api/inventories/[id]` | GET | JWT | Get inventory + photos |
| `/api/inventories/[id]` | PATCH | JWT | Update fields |
| `/api/inventories/[id]` | DELETE | JWT | Delete + cascade photos |
| `/api/photos` | POST | JWT | Upload photo (multipart) |
| `/api/photos/[id]` | DELETE | JWT | Delete photo |
| `/api/inventories/[id]/send-email` | POST | JWT | Generate PDF → upload to 27sign → email tenant signing link |
| `/api/confirm/[token]` | GET | Public | Fetch inventory preview for tenant |
| `/api/confirm/[token]` | POST | Public | Submit legacy tenant confirmation |
| `/api/webhooks/signing` | POST | Public | Receive signed document webhook from 27sign (HMAC verified) |
| `/api/health` | GET | Public | Health check |

---

## 27sign Integration (document signing flow)

When an agent clicks "Email Tenant", the send-email route:
1. Fetches all photos for the inventory
2. Generates a PDF report via `pdf-lib` (property details + room photos + signature lines)
3. Calls 27sign's one-call API (`POST /api/v1/requests` multipart) with:
   - The PDF file
   - Signature + date field placements on the last page
   - Signer email, callback URL, webhook secret
4. Gets back a signing URL → includes in the tenant email
5. Stores `signing_request_id` on the inventory

When the tenant signs via esign.relentify.com:
- 27sign sends webhook to `/api/webhooks/signing`
- Webhook verified via HMAC-SHA256 (`X-Signature-256` header)
- Inventory updated: `tenant_confirmed = TRUE`, `confirmed_at`, `tenant_signature_data`
- PDF report page shows the captured signature

**Fallback:** If 27sign is unavailable, falls back to legacy `/confirm/[token]` flow.

**Env vars:**
- `SIGNING_API_KEY` — rs_live_... API key for 27sign
- `SIGNING_WEBHOOK_SECRET` — HMAC secret for webhook verification
- `SIGNING_SERVICE_URL` — `http://27sign:3000` (Docker internal)

---

## UI Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | JWT | Dashboard — inventory list + stats grid |
| `/inventory/new` | JWT | Create new inventory form |
| `/inventory/[id]` | JWT | Detail — photos, email tenant, copy link |
| `/inventory/[id]/edit` | JWT | Edit inventory fields |
| `/report/[id]` | JWT | Print-ready PDF report with photos + signature |
| `/confirm/[token]` | Public | Legacy tenant confirmation (Preset D theme) |

---

## Test coverage

| Suite | Count | What's covered |
|-------|-------|---------------|
| MCP tests | **20/20** | CRUD, photos (3 conditions), tenant confirm (GET/POST/409), send email, check-out type, cascade delete, UI pages |
| E2E browser (Chrome) | **21/21** | All pages load, form fields, room picker, photo capture, email button, report view, confirm page, print button, delete button |

Run: `cd /opt/infra/mcp/23inventory-mcp && source venv/bin/activate && python3 run_tests.py`
Run: `cd /opt/infra/e2e-tests && ./node_modules/.bin/playwright test --project=23inventory`

---

## What's tested vs what needs manual testing

**Automated and passing:**
- All CRUD operations
- Photo upload/delete with condition ratings
- Tenant confirmation flow (legacy text-only)
- All 6 pages load in real Chrome browser
- Form validation, room picker, photo capture UI elements

**Needs manual verification:**
- 27sign integration E2E: send email → tenant receives → signs via esign.relentify.com → webhook fires → inventory confirmed with signature → PDF report shows signature
- Mobile touch interactions (photo capture on phone)
- Large inventories (50+ photos) — performance with base64 storage

---

## Known gaps — deferred

- **Base64 image storage** — suitable for low-medium volume, S3 migration at scale
- **No PDF email delivery** — tenant gets a signing link, not the PDF directly
- Branded PDF reports (agent logo, colours)
- Batch operations / export multiple inventories
- Inventory templates (pre-built room lists per property type)
- Check-in vs check-out comparison view
- Mobile app / PWA
