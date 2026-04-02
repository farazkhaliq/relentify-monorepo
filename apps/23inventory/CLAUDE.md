# Relentify Inventory — Claude Notes

## What this app does
Property inventory management for landlords and letting agents. Create check-in and check-out inventories, upload room-by-room photos with condition ratings, share a token-based confirmation link for tenants to digitally sign off, and generate print-to-PDF reports.

**URL:** https://inventory.relentify.com
**Container:** `23inventory` on port 3023
**Network:** `infra_default`
**Source:** `/opt/relentify-monorepo/apps/23inventory/` (pnpm + Turborepo monorepo)

---

## Tech stack
- Next.js 15 App Router (TypeScript)
- Prisma 5 ORM with **local generated client** (`src/generated/client`) — NOT the shared `@relentify/database` client
  - Local schema at `prisma/schema.prisma` → points to `inventory` DB (camelCase column names)
  - Shared `@relentify/database` uses snake_case — incompatible with this DB; local client is intentional
- PostgreSQL: `infra-postgres`, db: `inventory`, user: `relentify_user`
- Auth: shared JWT cookie (`relentify_token`) via `@relentify/auth`; middleware redirects to `login.relentify.com`
- Photos stored as base64 `imageData` in DB (not filesystem — acceptable for now, S3 later at scale)
- `@relentify/ui` for all UI components (NavShell, TopBar, UserMenu, etc.)

---

## Database schema

**Two tables** (Prisma models):

### Inventory
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| userId | String | Multi-tenancy key — always filter by this |
| propertyAddress | String | Full address |
| type | String | 'check-in' or 'check-out' |
| createdAt | DateTime | |
| createdBy | String | Agent name |
| notes | String? | Optional notes |
| tenantConfirmed | Boolean | Default false |
| confirmedAt | DateTime? | Set on tenant sign-off |
| confirmedIp | String? | IP for audit trail |
| confirmToken | String | Unique token for public confirmation link |

### Photo
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| inventoryId | String | FK → Inventory (cascade delete) |
| room | String | e.g. "Living Room", "Kitchen" |
| description | String? | Notes about the photo |
| condition | String | "Good", "Fair", or "Poor" |
| imageData | Text? | Base64-encoded image |
| uploadedAt | DateTime | |

---

## Key files
- `prisma/schema.prisma` — local DB schema (output → `src/generated/client`)
- `src/lib/auth.ts` — `getAuthUser()` returns `{ userId, email, fullName, userType }` from JWT
- `src/lib/prisma.ts` — local Prisma client singleton (imports from `../generated/client`)
- `src/components/PhotoManager.tsx` — room tabs + photo upload (client component, main complexity)
- `src/components/CopyConfirmLink.tsx` — clipboard button for tenant link
- `src/components/DeleteInventoryButton.tsx` — delete with confirm modal
- `middleware.ts` — JWT auth on all routes except `/confirm/*` and `/api/confirm/*`
- `app/(main)/layout.tsx` — NavShell + TopBar layout (uses `@relentify/ui`)

---

## API Routes

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/inventories` | GET | ✅ | List user's inventories |
| `/api/inventories` | POST | ✅ | Create inventory |
| `/api/inventories/[id]` | GET | ✅ | Get inventory + photos |
| `/api/inventories/[id]` | PATCH | ✅ | Update address/type/notes/createdBy |
| `/api/inventories/[id]` | DELETE | ✅ | Delete + cascade photos |
| `/api/photos` | POST | ✅ | Upload photo (multipart) |
| `/api/photos/[id]` | DELETE | ✅ | Delete photo |
| `/api/inventories/[id]/send-email` | POST | ✅ | Send confirmation email to tenant (saves tenantEmail + emailSentAt) |
| `/api/confirm/[token]` | GET | ❌ public | Fetch inventory preview for tenant |
| `/api/confirm/[token]` | POST | ❌ public | Submit tenant confirmation |
| `/api/health` | GET | ❌ public | Health check |

---

## UI Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | Yes | Dashboard — list all inventories with counts |
| `/inventory/new` | Yes | Create new inventory form |
| `/inventory/[id]` | Yes | Inventory detail + photos + confirmation link |
| `/inventory/[id]/edit` | Yes | Edit inventory form |
| `/report/[id]` | Yes | Print-ready PDF report with photos |
| `/confirm/[token]` | No | Public tenant confirmation page |

**Total**: 6 pages (4 authenticated + 1 report + 1 public)

---

## Multi-tenancy
- Every `Inventory` row has `userId` tied to the JWT `userId`
- ALL queries include `where: { userId }` — never query without it
- Photos are child of inventory — implicit user scoping

---

## Deployment
```bash
cd /opt/relentify-monorepo
docker compose -f apps/23inventory/docker-compose.yml down
docker compose -f apps/23inventory/docker-compose.yml build --no-cache
docker compose -f apps/23inventory/docker-compose.yml up -d
docker logs 23inventory --tail 50
```

Build context is the **monorepo root** (`../../`). Dockerfile uses `turbo prune inventory --docker` then pnpm.
The build runs `npx prisma generate --schema ./prisma/schema.prisma` inside the container to generate the local client.

Migrate DB: `docker exec 23inventory npx prisma migrate deploy --schema prisma/schema.prisma`

---

## Feature Build Status

### ✅ Complete — core workflow fully works

- **Dashboard** — list all inventories with counts (total / check-in / check-out / confirmed)
- **Create inventory** — property address, type (check-in/out), agent name, notes, optional tenant email
- **Email to tenant** — "Email Tenant" button on detail page sends Resend email with confirmation link; stores `tenantEmail` + `emailSentAt` on inventory; button turns green after send; email can also be set on creation
- **Photo upload** — camera + file upload, auto-compress to JPEG 82% @ max 1400px, stored as base64 in DB
- **Room organisation** — tab-based by room; default rooms + custom room creation
- **Condition ratings** — Good / Fair / Poor per photo with colour coding
- **Photo descriptions** — notes per photo
- **Delete photo** — immediate remove from DB
- **Tenant confirmation** — unique token link → public form → records IP + timestamp on submit
- **PDF report** — `/report/[id]` renders full inventory with photos, print via Ctrl+P/Cmd+P
- **Delete inventory** — with confirm modal, cascades all photos
- **Edit inventory** — `/inventory/[id]/edit` page; PATCH API + Edit button on detail page (added 2026-03-09)
- **Multi-tenancy** — userId isolation on all queries
- **Dark mode** — ✅ fixed (2026-04-02): all hardcoded `text-white`/`bg-white` replaced with theme variables
- **Mobile layout** — ✅ fixed (2026-04-02): responsive padding/gaps on all pages + TopBar hamburger menu
- **Auth** — JWT middleware, public routes for confirm/report/webhooks
- **27sign integration** — send-email creates signing request via 27sign API; webhook receives signature data; PDF report embeds tenant signature

### ⚠️ Known gaps — deferred post-launch

- **Base64 image storage** — suitable for low-medium volume, will need S3 migration at scale
- ~~**Mobile layout**~~ — ✅ fixed (2026-04-02): hamburger menu on TopBar, responsive padding/gaps on all 6 pages
- ~~**Dark mode gaps**~~ — ✅ fixed (2026-04-02): 7 hardcoded colour values replaced with CSS variables
- ~~**Signature capture**~~ — ✅ integrated (2026-04-02): 27sign handles digital signatures via draw/upload/saved; PDF report embeds tenant signature
- **No PDF email delivery** — report must be printed/saved manually
- ~~**Confirm page: already-confirmed state**~~ — ✅ fixed (2026-03-10): GET response now checks `tenantConfirmed` and jumps straight to the success state. POST 409 also handled gracefully.
- ~~**No Edit shortcut on dashboard list**~~ — ✅ fixed (2026-03-10): Edit link added to each dashboard table row.

### ❌ Not built — future roadmap

- ~~Digital signature capture on confirmation~~ — ✅ done via 27sign (2026-04-02)
- Branded PDF reports (agent logo, colors)
- Batch operations / export multiple inventories
- Inventory templates (pre-built room lists per property type)
- Comparison view (check-in vs check-out side by side)
- S3/object storage for photos (replace base64 DB storage)
- Mobile app / PWA

---

## Launch readiness assessment

**Current state: ✅ Ready to launch (2026-03-25) — all pre-launch checks passed**

### Pre-launch checks (2026-03-25)

| Check | Result | Notes |
|-------|--------|-------|
| Next.js version | ✅ 15.5.14 | Above vulnerable 15.2.3 (CVE GHSA-9qr9-h5gf-34mp) |
| `pnpm audit` | ✅ Pass | 1 moderate `yaml` vuln in dev/build dep — no production exposure |
| Health endpoint `GET /api/health` | ✅ 200 | |
| Dashboard `GET /` | ✅ 200 | Inventory list + stats render |
| New inventory `GET /inventory/new` | ✅ 200 | Create form renders |
| Inventory detail `GET /inventory/[id]` | ✅ 200 | Photos, edit/delete buttons present |
| Edit page `GET /inventory/[id]/edit` | ✅ 200 | PATCH form renders |
| Report page `GET /report/[id]` | ✅ 200 | **Was 500 — fixed (see below)** |
| Inventory CRUD (create/list/get/update/delete) | ✅ Pass | MCP test suite |
| Photo upload (multipart, 3 rooms) | ✅ Pass | Living Room/Good, Kitchen/Fair, Bedroom/Poor |
| Photo delete | ✅ Pass | |
| Tenant confirm flow (GET → POST → 409 duplicate) | ✅ Pass | Public endpoint, no auth |
| Cascade delete (photos removed with inventory) | ✅ Pass | |
| MCP test suite total | ✅ **16/16 passed** | `/opt/infra/mcp/23inventory-mcp/run_tests.py` |

### Bug fixed: report page 500 (2026-03-25)

**Root cause:** `app/report/[id]/page.tsx` is a Server Component. It was rendering:
```tsx
<Button onClick={() => window.print()}>🖨 Print / Save PDF</Button>
```
`Button` from `@relentify/ui` is a Client Component. Next.js 15 rejects passing event handlers
(`onClick`) across the Server→Client boundary at render time → HTTP 500.

**Fix:** Extracted the button into a dedicated `'use client'` component:
- **New file:** `src/components/PrintButton.tsx` — wraps the button with `'use client'` and calls `window.print()`
- **Edited:** `app/report/[id]/page.tsx` — removed `Button` import, replaced with `<PrintButton />`
- **Rebuilt:** container from scratch, `16/16` tests confirmed passing

### Monorepo rebuild history (March 2026)

Rebuilt from standalone app to monorepo pattern:
- Dockerfile: turbo prune + pnpm (from monorepo root context)
- next.config.js: `output: 'standalone'` + `outputFileTracingRoot` pointing to monorepo root
- postcss.config.js: `@tailwindcss/postcss` for Tailwind v4 utility class generation
- middleware.ts: fixed redirect URL using `x-forwarded-host` header (not `req.url`)
- All `@relentify/ui2` imports replaced with `@relentify/ui`
- Next.js 15 async params fixed across all route handlers and page components
- Local Prisma client (Prisma 5, pinned to `^5.22.0`) to match the `inventory` DB schema

The core workflow is fully working end-to-end. Real agents can:
1. Create an inventory (optionally capturing tenant email upfront)
2. Walk a property room by room, taking photos
3. Rate condition, add notes per photo
4. Email the tenant a confirmation link directly from the detail page
5. Generate and print a PDF report

### Remaining known gaps (deferred post-launch)

- **Mobile layout** — no hamburger menu; agents on phones will find it awkward (tablet landscape is fine)
- **Dark mode gaps** — some hardcoded `text-gray-`/`bg-gray-` classes remain on detail + new form pages
- **Base64 image storage** — will need S3 migration at scale
