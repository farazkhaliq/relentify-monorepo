# Relentify Monorepo

pnpm + Turborepo monorepo. All apps are Next.js (or Vite for 20marketing).
All UI components, theming, and navigation must come from `@relentify/ui`.

---

## Apps

| App | Container | Port | Notes |
|-----|-----------|------|-------|
| 20marketing | 20marketing | 3020 | Next.js App Router, shared TopBar, live at relentify.com |
| 21auth | 21auth | 3021 | Auth pages only, no main nav |
| 22accounting | 22accounting | 3022 | TopBar layout (no sidebar) |
| 23inventory | 23inventory | 3023 | TopBar layout |
| 24reminders | 24reminders | 3024 | TopBar layout |
| 25crm | ~~25crm~~ → platform | 3040 | **Retired** — migrated to platform (2026-04-04) |
| 26help | 26help | 3026 | Static export (output: 'export'), TopBar layout, Pagefind search, help.relentify.com |
| 27sign | 27sign | 3027 | Digital signature service, Preset D theme, sign.relentify.com |
| 28timesheets | 28timesheets | 3028 | GPS-verified mobile timesheets, Preset B theme, timesheets.relentify.com |
| 29chat | ~~29chat~~ → platform | 3040 | **Retired** — migrated to platform (2026-04-04) |
| 30connect | ~~30connect~~ → platform | 3040 | **Retired** — migrated to platform (2026-04-04) |
| platform | platform | 3040 | Unified comms platform: chat + connect + crm, serves 3 domains |

**Container naming**: All containers are named to match their app folder (20marketing, 21auth, etc.).
The old names (relentify-com, relentify-login, relentify-accounts, etc.) are retired — containers deleted.

## Packages

| Package | Purpose |
|---------|---------|
| `@relentify/ui` | All shared UI: buttons, colours, layout, navigation, theme |
| `@relentify/database` | Prisma ORM + DB utilities |
| `@relentify/auth` | JWT / auth logic |
| `@relentify/config` | Shared config |
| `@relentify/utils` | Shared utilities |
| `@relentify/chat` | Shared chat services + components (extracted from 29chat during CRM integration) |
| `@relentify/connect` | Shared multi-channel services + components (extracted from 30connect during CRM integration) |

---

## Communications Platform (Active Project)

Layered communications platform: `CRM ⊃ Connect ⊃ Chat`. Competes with Tawk.to, Intercom, Zendesk.

### Architecture: Single App, Three Products

**Master plan**: `PLANS/unified-platform-plan.md` (replaces all previous plans)

One Next.js app (`apps/platform/`) serves all 3 domains. Middleware reads hostname → sets product context → nav/pages/API adapt.

```
chat.relentify.com    → platform (product=chat)     — webchat + inbox + AI + ticketing
connect.relentify.com → platform (product=connect)  — + multi-channel + bots + workflows + voice
crm.relentify.com     → platform (product=crm)      — + contacts + properties + tenancies + reports
```

### Migration Status

| Phase | Status | What |
|-------|--------|------|
| 1 | ✅ Complete | Platform shell — middleware, product context, feature flags, adaptive layout |
| 2 | ✅ Complete | Move Chat (29chat) — 16 services, 54 API routes, 8 components, 14 pages |
| 3 | ✅ Complete | Move Connect (30connect) — 14 services, 25 API routes, 5 components, 6 pages |
| 4 | ✅ Complete | Move CRM (25crm) — 15 services, 44 API routes, 44 components, 17 pages |
| 5 | ✅ Complete | Deploy — Caddy switched, old containers retired (2026-04-04) |
| 6 | ✅ Complete | Cleanup — docs updated |

### Current State (Post-Migration)

One container serves all three products:
- `platform` (port 3040) — **live**, serves chat.relentify.com, connect.relentify.com, crm.relentify.com
- `29chat`, `30connect`, `25crm` containers **retired and removed** (2026-04-04)
- Source at `apps/29chat/`, `apps/30connect/`, `apps/25crm/` preserved as archive (git history)

### Archived Plans (all completed, superseded by unified-platform-plan.md)

| Plan | Status |
|------|--------|
| `PLANS/29chat-build.md` | ✅ Done (15/15 phases) |
| `PLANS/30connect-build.md` | ✅ Done (9/10 phases) |
| `PLANS/crm-integration-build.md` | ✅ Done |
| `PLANS/marketing-pages-build.md` | ✅ Done |
| `PLANS/product-composition-architecture.md` | ✅ Decision made (Option C) |
| `PLANS/communications-platform-master-plan.md` | Reference (pricing, competitive analysis) |

---

## The Golden Rule: No Local UI Components

Apps must not define their own UI components, colours, or navigation shells.
Every button, colour, layout component, sidebar, topbar, and theme token
must be imported from `@relentify/ui`.

### What belongs in each app:
- Route definitions and page-level data fetching
- Navigation *items* (the links/labels passed as props to shared nav components)
- Business logic and app-specific hooks

### What does NOT belong in apps:
- Custom button styles or button components
- Hardcoded Tailwind colour classes (e.g. `text-green-600`, `bg-red-500`)
- Local copies of UI components (shadcn or otherwise)
- A local ThemeProvider — always use the one from `@relentify/ui`
- A local Sidebar, TopBar, or NavShell — always use from `@relentify/ui`
- A `src/components/ui` directory — all UI primitives must come from `@relentify/ui`

### Colour values in .tsx files

**Never use hex codes or `hsl()` values in `.tsx` files.** Use `@relentify/ui` theme variables instead (e.g. `var(--theme-primary)`).

**Exemption**: `src/lib/email.ts` and `route.ts` files that generate HTML email may use hex codes, as inline styles are required for email clients.

---

## Theme Colour Tokens

Use CSS variables — never hardcoded Tailwind colour classes:

| Token | Use for |
|-------|---------|
| `var(--theme-success)` | Positive/income values (not `text-green-600`) |
| `var(--theme-destructive)` | Errors/negative values (not `bg-red-500`) |
| `var(--theme-warning)` | Warnings |
| `var(--theme-accent)` | Call-to-action colour |
| `var(--theme-primary)` | Brand colour |
| `var(--theme-background)` | Page background |
| `var(--theme-card)` | Card/panel background |
| `var(--theme-border)` | Borders |
| `var(--theme-text)` | Body text |
| `var(--theme-text-muted)` | Secondary text |
| `var(--theme-text-dim)` | Tertiary/disabled text |
| `var(--theme-destructive)` | Error/danger states |

Example:
```tsx
// ✅ Correct
<span className="text-[var(--theme-success)]">+£1,200</span>
<span className="text-[var(--theme-destructive)]">-£400</span>

// ❌ Wrong — hardcoded colour
<span className="text-green-600">+£1,200</span>
<span className="text-red-600">-£400</span>
```

---

## Navigation Patterns

### TopBar layout (20marketing, 23inventory, 24reminders)

```tsx
import { NavShell, TopBar, TopBarLink, TopBarButton, Logo, UserMenu } from '@relentify/ui'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <NavShell
      topbar={
        <TopBar
          logo={<Logo href="/" />}
          navLinks={
            <>
              <TopBarLink href="/dashboard">Dashboard</TopBarLink>
              <TopBarLink href="/reports">Reports</TopBarLink>
            </>
          }
          primaryAction={<TopBarButton href="/new">+ New</TopBarButton>}
        >
          <UserMenu name="Alex" />
        </TopBar>
      }
    >
      {children}
    </NavShell>
  )
}
```

### CollapsibleSidebar layout (22accounting, 25crm)

```tsx
import {
  SidebarProvider, CollapsibleSidebar, SidebarInset,
  SidebarHeader, SidebarContent, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup,
  SidebarGroupLabel, SidebarGroupContent
} from '@relentify/ui'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CollapsibleSidebar collapsible="icon">
        <SidebarHeader>
          {/* Logo / org name */}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/dashboard">Dashboard</a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </CollapsibleSidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
```

### Auth pages (21auth)

```tsx
import { AuthShell, ThemeToggleButton } from '@relentify/ui'

export default function LoginPage() {
  return (
    <AuthShell>
      {/* form content */}
    </AuthShell>
  )
}
```

---

---

## Reference Repo: farazkhaliq/relentify3

The canonical design source for 20marketing is the private repo cloned at `/tmp/relentify3/`.
This is the live version of relentify.com that shows what the site should look like.

**Key files to reference:**
- `/tmp/relentify3/src/pages/` — all marketing page components (Home, Accounting, CRM, etc.)
- `/tmp/relentify3/src/components/` — Navbar, Footer, Logo, ThemeSwitcher
- `/tmp/relentify3/src/App.tsx` — ThemeContext + RegionContext structure
- `/tmp/relentify3/src/themes.ts` — THEMES record (presets A/B/C/D)
- `/tmp/relentify3/src/index.css` — fonts, CSS variables, dark mode, noise-overlay

**Note**: The reference repo is a standalone Vite app (no monorepo). Its `import { useTheme } from '../App'`
pattern maps to our `import { useTheme } from '@relentify/ui'` (once migration below is complete).

---

## Session Progress (March 2026)

### Completed

1. **CLAUDE.md rules** — Added: no hex codes in .tsx (use CSS vars), no `src/components/ui` directories
2. **Removed `src/components/ui` dirs** from all 6 apps; moved files up to `src/components/`; fixed imports
3. **Container renaming** — All containers renamed to match app folder names (20marketing, 21auth, etc.)
4. **Port reassignment** — 3020–3025, Caddyfile updated to match
5. **Old containers deleted** — relentify-com, relentify-accounts, relentify-inventory, relentify-login, relentify-reminders deleted
6. **20marketing Docker rebuild** — Rewrote Dockerfile using `turbo prune` + pnpm + nginx
7. **20marketing now live** at relentify.com — site loads, navbar has Suite dropdown with all 7 products, region switcher works
8. **CSS visual fix** — Fixed 5 visual issues identified by Gemini:
   - `apps/20marketing/src/styles/globals.css`: Added `:root` CSS variable block (was missing entirely), `.shadow-cinematic` class, `.dark` variable overrides, native CSS `rounded-cinematic` (fixes Tailwind 4 `@apply` issue)
   - `apps/20marketing/src/app/App.tsx`: Expanded useEffect to inject `--theme-card`, `--theme-border`, `--theme-text-muted`, `--theme-text-dim` (was only injecting 5 color vars before)
   - `packages/ui/src/styles/globals.css`: Fixed `--shadow-cinematic` from invisible 4% opacity to visible 18% multi-layer; native CSS `rounded-cinematic`
   - `packages/ui/src/components/layout/ThemeProvider.tsx`: Fixed dark mode `--theme-card` from 3% (invisible) to `rgba(26,26,26,0.9)`; light mode card to `#ffffff` (solid)

### 20marketing Architecture (migrated 2026-04-03)

20marketing was migrated from Vite + React Router to **Next.js 15 App Router** on 2026-04-03.

- `app/layout.tsx` — Server component, uses `ThemeProvider` + `RegionProvider` from `@relentify/ui`, shared `TopBar` for navigation
- `app/components/` — Marketing-specific client components: `Footer.tsx`, `RegionSwitcher.tsx`, `Analytics.tsx`, `ChatWidget.tsx`, `CookieBanner.tsx`
- `app/lib/themes.ts` — Local copy of THEMES (kept for `theme.palette.dark` and `theme.typography.headings` used by Footer and pages)
- All pages import `useTheme`, `useRegion`, `formatPrice`, `cn` from `@relentify/ui`
- All pages are `'use client'` (they use hooks, framer-motion, gsap)
- Shared `TopBar` with dark mode toggle, Apps dropdown, Blog link, RegionSwitcher, Login
- Old `src/` directory deleted (Vite app, React Router, local Navbar, ThemeSwitcher)
- Chatwoot live chat widget via `ChatWidget.tsx` component
- Docker: Next.js standalone (same pattern as all other apps), 384M memory limit

---

## Docker Rebuild Pattern for Monorepo Apps

Every Next.js app in this monorepo follows the same Docker build pattern. Use this checklist when rebuilding any app:

### Required files in each app

**`Dockerfile`** — turbo prune + pnpm, always this structure:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune <app-name> --docker   # app-name = "name" field in package.json

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/<appdir>/node_modules ./apps/<appdir>/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
RUN cd packages/database && npx prisma generate
WORKDIR /app/apps/<appdir>
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/<appdir>/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/<appdir>/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/<appdir>/.next/static ./apps/<appdir>/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/<appdir>/server.js"]
```

**`docker-compose.yml`** — context must be monorepo root (`../../`):
```yaml
services:
  web:
    build:
      context: ../../
      dockerfile: apps/<appdir>/Dockerfile
    container_name: <appdir>
    ports:
      - "30XX:3000"
    env_file:
      - .env
    networks:
      - infra_default

networks:
  infra_default:
    external: true
    name: infra_default
```

**`next.config.js`** — must have `output: 'standalone'` AND `outputFileTracingRoot`:
```js
const path = require('path')
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),   // CRITICAL — puts server.js at apps/<appdir>/server.js
  transpilePackages: ["@relentify/ui", "@relentify/database", "@relentify/auth", "@relentify/config", "@relentify/utils"],
}
module.exports = nextConfig
```

**`postcss.config.js`** — required for Tailwind v4 CSS generation:
```js
module.exports = {
  plugins: { '@tailwindcss/postcss': {} },
}
```
Also add to `package.json` devDependencies: `"@tailwindcss/postcss": "^4.2.1"`

Without `postcss.config.js` + `@tailwindcss/postcss`, `@import "tailwindcss"` passes through as raw CSS
— the CSS bundle will have CSS variables but **zero utility classes** (no `flex`, `w-6`, etc.).

**`COPY --from=deps /app/packages/ui/node_modules`** — required in the builder stage when `transpilePackages: ['@relentify/ui']` is set. `packages/ui/src/index.ts` imports `'./styles/globals.css'` which contains `@import "tailwindcss"`. Without this COPY, webpack resolves tailwindcss from packages/ui's directory context and fails with `Can't resolve 'tailwindcss' in '/app/packages/ui/src/styles'`. This is already in the Dockerfile template above.

### Middleware redirect URL fix

All app middlewares must reconstruct the public URL from headers, NOT from `req.url` (which is `0.0.0.0:3000`):
```typescript
const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'fallback.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`
// Then: NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))
```
Caddy sets `Host` to the public hostname — the fallback `req.headers.get('host')` is sufficient.

### Database access pattern

Apps that use raw SQL must use a real `pg.Pool`, not a Prisma wrapper:
```typescript
// src/lib/db.ts
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const query = (sql: string, params?: unknown[]) => pool.query(sql, params as any[])
export default pool
```
Prisma's `$queryRawUnsafe()` passes all params as `text` type — Postgres rejects UUID columns with
`column "user_id" is of type uuid but expression is of type text`.
Add `pg` and `@types/pg` via `pnpm add pg @types/pg --filter <appname>`, then run `pnpm install`.

Apps using Prisma ORM directly (via `@relentify/database`) are fine — this only affects raw SQL wrappers.

### Next.js 15 async params

Route handlers and page components must treat `params` as a Promise:

**API route handlers:**
```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // use id, not params.id
}
```

**Server page components (async):**
```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

**Client page components:**
```typescript
import { use } from 'react'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
}
```

### Prisma version: always pin to `^5.22.0`

The monorepo uses Prisma 5 (`packages/database` has `"prisma": "^5.22.0"`). If an app needs
its own Prisma client (e.g. a local schema with custom output), always pin to `^5.22.0` — NOT `^7.x`.

**Why**: Prisma 7 removed `url = env(...)` from `datasource` in `schema.prisma`, breaking the entire
generate step. The error looks like: `The datasource property url is no longer supported in schema files`.
The fix: downgrade to `^5.22.0` in both `prisma` (devDep) and `@prisma/client` (dep).

### @relentify/ui component API — known gotchas

When migrating older apps to use `@relentify/ui`, these props/names differ from what apps may assume:

| App used | Correct `@relentify/ui` equivalent |
|---|---|
| `<PageHeader subtitle="...">` | `<PageHeader description="...">` |
| `<PageHeader center>` | Not supported — remove the prop |
| `<Badge variant="secondary">` | `<Badge variant="outline">` |
| `<Toast />` (imported as `Toast`) | Import as `Toaster`, render `<Toaster />` |
| `<Logo text="X" icon={...} href="/">` | Wrap in `<Link href="/"><Logo /></Link>` — Logo only accepts `className`, `iconClassName`, `showText` |
| Native `<Select onChange={...}>` | Use `NativeSelect` for native HTML select; use `Select` + `SelectTrigger`/`SelectContent`/`SelectItem` for Radix |
| Shadcn `<Tabs defaultValue>` | Use `Tabs` (Radix root) + `TabsList`, `TabsTrigger`, `TabsContent` |
| Old pill-tab `<Tabs options={...}>` | Use `TabsNav` with `options`, `selectedValue`, `onValueChange` props |

**Logo pattern** (correct way to make it a link):
```tsx
import Link from 'next/link'
import { Logo } from '@relentify/ui'

<Link href="/" className="no-underline flex items-center">
  <Logo className="text-lg" iconClassName="w-5 h-5" />
</Link>
```

### Missing packages — common ones apps forget to declare

Apps built before the monorepo migration often assumed packages from `node_modules` without declaring
them in their own `package.json`. These get caught at Docker build time. Common ones:

- `uuid` + `@types/uuid` — for `v4 as uuidv4`
- `jsonwebtoken` + `@types/jsonwebtoken` — for JWT signing (prefer `@relentify/auth` instead)
- `date-fns` — date formatting
- `framer-motion` — animations
- `pg` + `@types/pg` — raw SQL queries (always needed alongside raw SQL services)

Add missing packages with: `pnpm add <pkg> --filter <appname>` then `pnpm install` at root.

### After any pnpm add, always run `pnpm install` from monorepo root

`pnpm install --frozen-lockfile` in Docker requires pnpm-lock.yaml to exactly match package.json.
After `pnpm add <pkg> --filter <app>`, the lockfile updates but verify with `pnpm install` at root.

---

## Security — Vulnerability Management

### Automated scanning

`pnpm audit` runs daily at 9am via cron and sends a Telegram alert if any vulnerabilities are found.
To run manually: `cd /opt/relentify-monorepo && pnpm audit`

### Fixing vulnerabilities — decision framework

Run `pnpm audit` and categorise each finding:

**1. Direct dependency, fix available** → upgrade it:
```bash
pnpm update <package>@<version> --recursive --force
```

**2. Direct dependency, no fix exists** (`Patched versions: <0.0.0`) → replace the library.
Check what it's actually used for before choosing a replacement. `xlsx` is the known case — replaced with `exceljs`.

**3. Transitive dependency (pinned by an upstream package)** → use pnpm overrides in root `package.json`:
```json
"pnpm": {
  "overrides": {
    "vulnerable-package": ">=fixed-version"
  }
}
```
Then run `pnpm install`. This forces all transitive resolution to use the patched version.
Use this when the vulnerable package is deep in a dep chain you don't control (e.g. AWS SDK, genkit, firebase internals).

**4. Dev-only dependency with no production exposure** → lowest priority, but still fix if a patch exists.

### Current overrides (root package.json)

| Package | Override | Reason |
|---------|----------|--------|
| `fast-xml-parser` | `>=5.5.7` | AWS SDK (`@aws-sdk/xml-builder`) and genkit pin old versions |
| `@tootallnate/once` | `>=3.0.1` | Deep in genkit → Google Cloud logging chain |

### Known replaced libraries

| App | Removed | Replaced with | Reason |
|-----|---------|---------------|--------|
| 22accounting | `xlsx@0.18.5` | `exceljs` | No patched version will ever exist (SheetJS community) |

---

## Database Schema

**Live schema explorer**: https://db.relentify.com/schema (basic auth, same as n8n)

### Key concepts
- **`users`** — every person with an account. Has `subscription_plan` (updated by Stripe webhooks).
- **`entities`** — a business/organisation. One user can own multiple entities (multi-tenancy). `users.active_entity_id` points to the currently selected entity.
- Most tables have `user_id` + `entity_id` columns to scope data per-user per-entity.

### Which app owns which tables (relentify database)
| Prefix | Owner | Count | Examples |
|--------|-------|-------|---------|
| (none) | Platform (21auth) | 5 | `users`, `entities`, `app_access`, `password_reset_tokens`, `waitlist_signups` |
| `acc_` | 22accounting | 42 | `acc_invoices`, `acc_bills`, `acc_customers`, `acc_journal_entries`, `acc_chart_of_accounts`, etc. |
| `crm_` | 25crm | 16 | `crm_contacts`, `crm_properties`, `crm_tenancies`, `crm_transactions`, etc. |
| `reminders_` | 24reminders | 7 | `reminders_tasks`, `reminders_lists`, `reminders_workspaces`, etc. |
| `inv_` | 23inventory | 2 | `inv_items`, `inv_photos` |
| `ts_` | 28timesheets | 20 | `ts_entries`, `ts_breaks`, `ts_shifts`, `ts_sites`, `ts_workers`, `ts_settings`, `ts_feed_events`, `ts_gps_pings`, etc. |
| `chat_` | 29chat | 13 | `chat_visitors`, `chat_config`, `chat_sessions`, `chat_messages`, `chat_ai_usage`, `chat_knowledge_articles`, `chat_tickets`, `chat_triggers`, `chat_webhooks`, `chat_api_keys`, `chat_push_subscriptions`, `chat_voice_config`, `chat_calls` |
| `connect_` | 30connect | 9 | `connect_channels`, `connect_conversations`, `connect_messages`, `connect_templates`, `connect_bots`, `connect_bot_sessions`, `connect_workflows`, `connect_workflow_runs`, `connect_qa_reviews` |

### Separate databases
| Database | Owner | Tables |
|----------|-------|--------|
| `esign` | 27sign | `api_keys`, `audit_log`, `otp_codes`, `signatures`, `signing_requests` |
| `simplecalc` | simplecalc | `sc_users`, `sc_login_tokens`, `sc_calculations`, `sc_email_leads` |
| `kingfisher` | kingfisher-web | `contact_submissions`, `prescription_requests`, `nominations` |
| `n8n_data` | n8n workflows | `org_manager_state`, `voice_assistant_state`, `snoozed_emails`, `email_exclusions`, `tweet_drafts` |

### Cross-app relationships
The three main app groups (Accounting, CRM, Reminders) are **self-contained** — no foreign keys cross between them. They only share `users` and `entities`. `acc_accountant_clients` is also queried by 21auth (registration referral flow).

---

## Development

```bash
pnpm dev                               # run all apps
pnpm build                             # build all packages + apps (Turbo handles order)
pnpm --filter @relentify/ui dev        # work on shared UI only
pnpm --filter 25crm dev                # work on one app only
pnpm db:generate                       # regenerate Prisma client
pnpm db:migrate                        # run DB migrations
```

Build order: `packages/*` → `apps/*` (handled automatically by Turbo).

---

## Deployment

All apps run as Docker containers on the VPS at `/opt/`. Each app in
`/opt/<app>/` has its own `docker-compose.yml`. See `/root/.claude/CLAUDE.md`
for full server reference.

```bash
# Rebuild and redeploy an app
cd /opt/<app>
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs <container> --tail 50
```
