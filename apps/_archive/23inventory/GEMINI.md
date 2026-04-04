This is the project context for Gemini.

# Relentify Inventory — Claude Notes

## What this app does
Property inventory management for landlords and letting agents. Create check-in and check-out inventories, upload room-by-room photos with condition ratings, share a token-based confirmation link for tenants to digitally sign off, and generate print-to-PDF reports.

**URL:** https://inventory.relentify.com
**Container:** `relentify-inventory` on port 3013
**Network:** `infra_default`

---

## Tech stack
- Next.js 14 App Router (TypeScript)
- Prisma ORM → PostgreSQL (`infra-postgres`, db: `inventory`, user: `relentify_user`)
- Auth: shared JWT cookie (`relentify_token`) from `login.relentify.com` — same as all Relentify apps
- Photos stored as base64 `imageData` in DB (not filesystem — acceptable for now, S3 later at scale)
- `@relentify/ui2` for ThemeToggleButton and THEME_SCRIPT

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
- `prisma/schema.prisma` — DB schema
- `lib/auth.ts` — `getAuthUser()` returns `{ userId, email, fullName, userType }` from JWT
- `lib/prisma.ts` — Prisma client singleton
- `components/PhotoManager.tsx` — room tabs + photo upload (client component, main complexity)
- `components/Sidebar.tsx` — left nav (Dashboard + New Inventory)
- `components/TopBar.tsx` — theme toggle + user menu
- `components/CopyConfirmLink.tsx` — clipboard button for tenant link
- `components/DeleteInventoryButton.tsx` — delete with confirm modal
- `middleware.ts` — JWT auth on all routes except `/confirm/*` and `/api/confirm/*`

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

## Multi-tenancy
- Every `Inventory` row has `userId` tied to the JWT `userId`
- ALL queries include `where: { userId }` — never query without it
- Photos are child of inventory — implicit user scoping

---

## Deployment
```bash
cd /opt/relentify-inventory
docker compose build --no-cache
docker compose up -d
docker logs relentify-inventory --tail 50
```

Migrate DB: `docker exec relentify-inventory npx prisma migrate deploy`

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
- **Dark mode** — mostly working (some gaps)
- **Auth** — JWT middleware, public routes for confirm/report

---

## Launch readiness assessment

**Current state: ~92% ready to launch**

The core workflow is fully working end-to-end. Real agents can:
1. Create an inventory (optionally capturing tenant email upfront)
2. Walk a property room by room, taking photos
3. Rate condition, add notes per photo
4. Email the tenant a confirmation link directly from the detail page
5. Generate and print a PDF report

**What's holding back a full launch:**
1. ~~**Inventory editing**~~ — ✅ done (edit page + PATCH API wired up)
2. ~~**Report page security**~~ — ✅ fixed (2026-03-10): added `getAuthUser()` + `userId` scope to `/report/[id]` — previously any authenticated user could view any inventory by UUID
3. **Mobile layout** (medium) — agents are often on-site with a phone; a hamburger sidebar would help a lot

THE GOLD STANDARD: Structural Hierarchy
Rule of Origin: If a component or style exists in @relentify/ui2, it is forbidden to exist within this repository.

Directory | Enforcement Protocol
-- | --
/src/app | Application Domain: Routes and business logic only. No primitive UI definitions.
/src/components/layout | Layout Integration: Must consume <NavShell />, <ThemeProvider />, and <RegionProvider /> from @relentify/ui2. No local Sidebar/TopBar logic.
/src/components/ui | The Exclusion Zone: This folder must be EMPTY of any atoms (Buttons, Inputs, Cards). Local components here are only permitted if they are complex, app-specific organisms that cannot be found in the UI2 inventory.
/src/hooks | State Consumption: Use @relentify/ui2 hooks. Local hooks are only for unique app-specific data fetching.
/src/styles | The Bridge: globals.css must only contain an @import of the UI2 stylesheet and app-specific overrides. Zero hardcoded hex/px values.

🎨 THE TOKEN MAP: Design DNA
Absolute Enforcement: Any value not derived from these CSS variables is a migration failure.
Color Palette: --theme-primary, --theme-accent, --theme-background, --theme-card, --theme-border, --theme-text.
Shadows: .shadow-cinematic (Must be inherited via the UI2 global CSS). Manual Tailwind shadows (e.g., shadow-xl) are illegal.
Geometry: .rounded-cinematic. Manual radii (e.g., rounded-2xl) are illegal.
Surfaces: .glass-panel. Manual backdrop-blurs are illegal.
Typography: Inter (Sans), JetBrains Mono (Mono), Playfair Display (Serif).

🛠️ THE FUNCTIONAL BLUEPRINT
1. The "Consumer" Protocol (No Local Shadows)
Dependency Rule: package.json must list @relentify/ui2.
Deletion Rule: Before any code change, the AI must search for local files that duplicate UI2 atoms. Action: Delete local file -> Update Import to @relentify/ui2.
Entry Point Rule: main.tsx or layout.tsx must import @relentify/ui2/dist/styles.css (or the package equivalent). If styles are missing, fix the import; do not recreate the CSS locally.

2. Strict Hardcoding Lockdown
To achieve a "Perfect Mirror," the following replacements are non-negotiable:
Zero Hex/RGBA: All color classes must use CSS variables.
Wrong: bg-[#10B981] or bg-green-500.
Right: bg-[var(--theme-accent)].
Zero Arbitrary Spacing: No p-[20px]. Use standard Tailwind spacing scale or UI2 defined variables.

Class Replacement Table:
shadow-sm/md/lg/xl/2xl $\rightarrow$ shadow-cinematic
rounded-lg/xl/2xl/3xl $\rightarrow$ rounded-cinematic
bg-white/bg-black $\rightarrow$ bg-[var(--theme-background)] or bg-[var(--theme-card)]

3. The Forensic Verification Step
Grep Audit: Search for relentify-ui (v1). Any match = FAILED.
Collision Audit: If src/components/ui/Button.tsx exists = FAILED.
Hardcode Audit: If any .tsx contains # or px (outside of rare SVGs) = FAILED.
