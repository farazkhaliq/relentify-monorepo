# 28timesheets Implementation Plan

## Context

Build a new GPS-verified mobile timesheet app for field staff. Full design spec at `docs/superpowers/specs/2026-04-02-timesheets-design.md` plus review additions (trust score, trigger-based feed, payroll summary, smart alerts, photo hash detection, wage leakage report, quick-start onboarding, idempotency keys).

**Key architectural decisions:**
- Follow 22accounting patterns exactly (raw pg, services, API routes, Docker)
- Trigger-based materialised feed (not computed UNION, not application-level writes)
- BottomTabBar added to `@relentify/ui` (Golden Rule: no local UI components)
- CollapsibleSidebar on desktop, BottomTabBar on mobile (auto-switch via `useIsMobile()`)
- Trust score (0-100) computed at clock-out, not via trigger
- Default deduction mode: `flag_for_review` (not `auto`)
- Photos stored as base64 in `ts_photos`/`ts_photo_data` tables (same pattern as 22accounting attachments)

---

## Phase 0: Update Spec + Update CLAUDE.md

**Goal:** Persist all review additions into the spec file before writing code.

### 0a. Update spec file

Edit `docs/superpowers/specs/2026-04-02-timesheets-design.md` to add:

1. **Trust score section** — add `trust_score` INTEGER (0-100) to `ts_entries` schema table. Add scoring table:
   - GPS within geofence (clock-in): +25
   - GPS within geofence (clock-out): +25
   - Photo present: +15
   - IP consistent with previous punches: +10
   - Device consistent: +10
   - All GPS pings within geofence: +10
   - GPS accuracy < 50m: +5

2. **Trigger-based materialised feed** — replace the "computed, not stored" description in feed.service.ts section. Add `ts_feed_events` table to schema:
   - `id UUID PK`
   - `user_id UUID` (workspace owner)
   - `entity_id UUID`
   - `worker_user_id UUID`
   - `event_type VARCHAR(30)`
   - `entry_id UUID` (nullable)
   - `shift_id UUID` (nullable)
   - `source_table VARCHAR(30)`
   - `source_id UUID`
   - `created_at TIMESTAMPTZ`
   Add trigger description: PostgreSQL AFTER INSERT/UPDATE triggers on ts_entries, ts_breaks, ts_shifts populate ts_feed_events automatically. No application-level feed event creation needed. Feed queries join back to source tables for current data.

3. **Payroll summary report** — add `GET /api/reports/payroll-summary` to API routes table. Returns structured JSON per worker per period: regular_minutes, overtime_minutes, overtime_rules_applied, deduction_minutes, hourly_rate, regular_pay, overtime_pay, total_pay, trust_score_avg.

4. **Default deduction mode** — change `ts_settings.deduction_mode` default from `'auto'` to `'flag_for_review'` in schema table.

5. **Edge case rules** — add table to Security section:
   - No GPS permission → allow, trust_score 0, flag for review
   - Signal lost mid-shift → continue, note "GPS unavailable" in feed
   - Browser closed → auto-clock-out cron handles it
   - Wrong site → geofence rules apply, manager notified
   - Overlapping shifts → reject: "Already clocked in"
   - Tab duplication → `idempotency_key` prevents double clock-in
   - Clock-in with no site → allowed if `project_tag_required = false`

6. **Photo hash + reuse detection** — add `clock_in_photo_hash VARCHAR(64)` and `clock_out_photo_hash VARCHAR(64)` to `ts_entries` schema. Add `ts_photos` and `ts_photo_data` tables. Add note: SHA-256 hash compared against last 30 days, reuse flagged in feed + trust_score reduced by 20.

7. **Wage leakage report** — update GPS report description in reports.service.ts section. Rename to "Wage & Attendance Report". Metrics: hours outside geofence, late arrivals, early departures, missed shifts, auto deductions applied, low trust score entries, overtime cost. Headline stat: "Estimated savings this month: £X".

8. **GPS summary fields** — add to `ts_entries` schema: `gps_ping_count INTEGER DEFAULT 0`, `gps_pings_in_fence INTEGER DEFAULT 0`, `gps_verification_pct DECIMAL`. Note: these persist after detailed pings are purged by data retention cron.

9. **Quick-start onboarding** — add `POST /api/workers/import` to API routes. Accepts CSV (name, email, hourly_rate). Creates users + workspace_members + ts_workers in bulk. No sites/rules required to start.

10. **Dashboard list-first** — update dashboard screen description: default is list view (worker name, status, location text, duration). Map is optional toggle using Leaflet + OpenStreetMap (free).

11. **Smart alerts** — add `ts_alert_rules` table to schema:
    - `id UUID PK`
    - `user_id, entity_id`
    - `name VARCHAR(255)`
    - `alert_type VARCHAR(30)` ('off_site_duration', 'late_arrivals_week', 'overtime_budget', 'pending_approvals_age')
    - `threshold_value INTEGER`
    - `is_active BOOLEAN DEFAULT true`
    - `created_at TIMESTAMPTZ`
    Add `GET/POST /api/alert-rules` and `PUT/DELETE /api/alert-rules/:id` to API routes.

12. **Idempotency keys** — add `idempotency_key VARCHAR(100) UNIQUE` to `ts_entries` schema. Add note: client generates UUID before clock-in request, server returns existing entry on duplicate key.

### 0b. Commit spec updates

Stage and commit: `[spec] Update timesheets spec with review additions`

---

## Phase 1: Scaffolding + Database + Basic Clock In/Out

**Goal:** Working app — clock in with GPS, clock out, see timer. The core loop.

### 1a. BottomTabBar in @relentify/ui

**Why first:** The app UI needs this component. Since the Golden Rule says no local UI components, add it to the shared package before creating the app.

Create `packages/ui/src/components/layout/BottomTabBar.tsx`:
```typescript
// Props interface
interface BottomTabBarProps {
  items: Array<{
    icon: ReactNode
    label: string
    href: string
    badge?: number
  }>
  activeHref: string
}
```
- `'use client'` directive (Framer Motion requires client component)
- Fixed bottom with `pb-[env(safe-area-inset-bottom)]` for iOS notch
- Only renders when `useIsMobile()` returns true (returns null on desktop)
- Theme variables: `bg-[var(--theme-card)]`, `text-[var(--theme-text-muted)]`, active: `text-[var(--theme-accent)]`
- Framer Motion `spring.snappy` for tap feedback via `variants.interactive`
- Badge renders as small red dot with count using `bg-[var(--theme-destructive)]`
- Uses `next/link` for navigation

Export from `packages/ui/src/index.ts`:
```typescript
export { BottomTabBar } from './components/layout/BottomTabBar'
```

### 1b. App scaffolding

Create `apps/28timesheets/` directory with these files:

**`package.json`:**
- Copy from `apps/22accounting/package.json`
- Change `"name"` to `"timesheets"`
- Change dev/start port to `3028`
- Remove accounting-specific deps: `exceljs`, `stripe`, `@stripe/stripe-js`, `resend`, `sharp`, `recharts`, `papaparse`, `pdf-lib`, `@aws-sdk/*`, `bcryptjs`
- Keep: `@relentify/ui`, `@relentify/auth`, `@relentify/database`, `@relentify/config`, `@relentify/utils`, `next@15.5.14`, `react@^19`, `react-dom@^19`, `pg`, `@types/pg`, `uuid`, `@types/uuid`, `jose`, `jsonwebtoken`, `@types/jsonwebtoken`, `zod`, `lucide-react`, `framer-motion`
- Add: `web-push`, `@types/web-push`

**`tsconfig.json`:** Copy from 22accounting verbatim. Key: `"paths": { "@/*": ["./*"] }`.

**`next.config.js`:**
```javascript
const path = require('path')
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ["@relentify/ui", "@relentify/database", "@relentify/auth", "@relentify/config", "@relentify/utils"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
```

**`postcss.config.js`:** `module.exports = { plugins: { '@tailwindcss/postcss': {} } }`

**`Dockerfile`:** Copy from `apps/22accounting/Dockerfile`. Replace:
- All `22accounting` → `28timesheets`
- `turbo prune accounting` → `turbo prune timesheets`
- Remove `ghostscript` from runner stage apk add (not needed)

**`docker-compose.yml`:**
```yaml
services:
  web:
    build:
      context: ../../
      dockerfile: apps/28timesheets/Dockerfile
    container_name: 28timesheets
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 384M
    ports:
      - "3028:3000"
    env_file:
      - .env
    networks:
      - infra_default
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  infra_default:
    external: true
    name: infra_default
```

**`.env.example`:**
```
DATABASE_URL=postgresql://relentify_user:PASSWORD@infra-postgres:5432/relentify
JWT_SECRET=CHANGE_ME
CRON_SECRET=CHANGE_ME
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_APP_URL=https://timesheets.relentify.com
NODE_ENV=production
```

**`middleware.ts`:**
- Copy structure from `apps/22accounting/middleware.ts`
- PUBLIC_PATHS: `['/api/health', '/api/cron/', '/api/v1/']`
- Remove accountant-specific logic (client token, accountant portal redirects)
- Auth check: verify `relentify_token` cookie via `@relentify/auth`
- Rate limiting: same in-process sliding window pattern
- Matcher: `['/worker/:path*', '/feed/:path*', '/dashboard/:path*', '/schedule/:path*', '/approvals/:path*', '/sites/:path*', '/workers/:path*', '/settings/:path*', '/team/:path*', '/reports/:path*', '/overtime-rules/:path*', '/break-rules/:path*', '/audit/:path*', '/api/:path*']`

**`src/styles/globals.css`:**
```css
@import "tailwindcss";
@import "@relentify/ui/src/styles/globals.css";
```

**`src/lib/db.ts`:** Copy `apps/22accounting/src/lib/db.ts` verbatim (Pool, query, withTransaction).

**`src/lib/auth.ts`:**
- Copy structure from `apps/22accounting/src/lib/auth.ts`
- Define `TimesheetPermissions` interface:
  ```typescript
  export interface TimesheetPermissions {
    timesheets: { view: boolean; create: boolean; approve: boolean }
    scheduling: { view: boolean; create: boolean; assign: boolean }
    reports:    { view: boolean; export: boolean }
    settings:   { view: boolean; manage: boolean }
    team:       { view: boolean; manage: boolean }
    sites:      { view: boolean; manage: boolean }
  }
  ```
- `JWTPayload` with `workspacePermissions?: TimesheetPermissions`
- `getAuthUser()`, `verifyToken()`, `generateToken()`, `setAuthCookie()`

**`src/lib/workspace-auth.ts`:**
- Copy `checkPermission()` from 22accounting
- Update module/action types to match `TimesheetPermissions` modules
- Owner always allowed, viewer always read-only (all mutations return 403)

**`src/lib/entity.service.ts`:**
- Copy `getActiveEntity()` pattern from 22accounting
- Queries `entities` table WHERE `user_id = $1` AND `is_default = true` (or uses `users.active_entity_id`)

**`src/lib/constants.ts`:**
```typescript
export const APP_NAME = 'Relentify Timesheets'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://timesheets.relentify.com'
```

**`app/layout.tsx`:**
- Copy from 22accounting
- ThemeProvider preset "B"
- THEME_SCRIPT in head
- Inter font
- Add `<link rel="manifest" href="/manifest.json" />`
- Add `<meta name="theme-color" content="#000000" />`
- Title: "Relentify Timesheets"

**`app/page.tsx`:** Redirect to `/worker` (default landing for unauthenticated redirect will go to login via middleware anyway).

**`app/api/health/route.ts`:**
```typescript
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ status: 'ok', app: 'timesheets' })
}
```

**`app/api/auth/me/route.ts`:**
- `getAuthUser()` → query `users` table for full name, email → query `workspace_members` for role + permissions → return combined payload

**`public/manifest.json`:**
```json
{
  "name": "Relentify Timesheets",
  "short_name": "Timesheets",
  "start_url": "/worker",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#F8F9FB",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 1c. Database migration 001 — all tables

File: `apps/28timesheets/database/migrations/001_core_tables.sql`

Creates ALL `ts_*` tables. Full SQL for each table follows the spec schema exactly. Key details:

- `ts_settings`: `deduction_mode VARCHAR(20) DEFAULT 'flag_for_review'`
- `ts_entries`: includes `trust_score INTEGER DEFAULT 0`, `gps_ping_count INTEGER DEFAULT 0`, `gps_pings_in_fence INTEGER DEFAULT 0`, `gps_verification_pct DECIMAL`, `idempotency_key VARCHAR(100) UNIQUE`, `clock_in_photo_hash VARCHAR(64)`, `clock_out_photo_hash VARCHAR(64)`
- `ts_workers`: includes `allowed_site_ids UUID[]`, `manager_user_id UUID`, all override fields
- `ts_feed_events`: `id, user_id, entity_id, worker_user_id, event_type VARCHAR(30), entry_id UUID, shift_id UUID, source_table VARCHAR(30), source_id UUID, created_at TIMESTAMPTZ`
- `ts_photos`: `id, entry_id, photo_type VARCHAR(10), hash VARCHAR(64), size_bytes INTEGER, created_at`
- `ts_photo_data`: `id, photo_id UUID FK, data BYTEA`
- `ts_alert_rules`: `id, user_id, entity_id, name, alert_type VARCHAR(30), threshold_value INTEGER, is_active BOOLEAN DEFAULT true, created_at`
- `ts_time_off_types` and `ts_time_off_requests`: V2, created empty

**Indexes:**
```sql
CREATE INDEX idx_ts_entries_worker_clock ON ts_entries(worker_user_id, clock_in_at);
CREATE INDEX idx_ts_entries_entity_status ON ts_entries(entity_id, status);
CREATE UNIQUE INDEX idx_ts_entries_idempotency ON ts_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ts_feed_events_entity_time ON ts_feed_events(entity_id, created_at DESC);
CREATE INDEX idx_ts_feed_events_worker ON ts_feed_events(worker_user_id, created_at DESC);
CREATE INDEX idx_ts_gps_pings_entry ON ts_gps_pings(entry_id, captured_at);
CREATE INDEX idx_ts_shifts_worker_date ON ts_shifts(worker_user_id, date);
CREATE INDEX idx_ts_breaks_entry ON ts_breaks(entry_id);
CREATE INDEX idx_ts_comments_entry ON ts_comments(entry_id, created_at);
```

### 1d. Database migration 002 — feed triggers

File: `apps/28timesheets/database/migrations/002_feed_triggers.sql`

```sql
-- Generic trigger function
CREATE OR REPLACE FUNCTION ts_create_feed_event() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ts_feed_events (
    id, user_id, entity_id, worker_user_id,
    event_type, entry_id, shift_id,
    source_table, source_id, created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.user_id,
    NEW.entity_id,
    NEW.worker_user_id,
    TG_ARGV[0],
    CASE WHEN TG_TABLE_NAME IN ('ts_entries', 'ts_breaks') THEN
      CASE WHEN TG_TABLE_NAME = 'ts_entries' THEN NEW.id
           WHEN TG_TABLE_NAME = 'ts_breaks' THEN NEW.entry_id
           ELSE NULL END
    ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'ts_shifts' THEN NEW.id ELSE NULL END,
    TG_TABLE_NAME,
    NEW.id,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ts_entries triggers
CREATE TRIGGER trg_ts_entries_insert
  AFTER INSERT ON ts_entries FOR EACH ROW
  EXECUTE FUNCTION ts_create_feed_event('clock_in');

CREATE TRIGGER trg_ts_entries_clock_out
  AFTER UPDATE OF clock_out_at ON ts_entries FOR EACH ROW
  WHEN (OLD.clock_out_at IS NULL AND NEW.clock_out_at IS NOT NULL)
  EXECUTE FUNCTION ts_create_feed_event('clock_out');

CREATE TRIGGER trg_ts_entries_status_change
  AFTER UPDATE OF status ON ts_entries FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION ts_create_feed_event('status_change');

CREATE TRIGGER trg_ts_entries_auto_clock_out
  AFTER UPDATE OF auto_clocked_out ON ts_entries FOR EACH ROW
  WHEN (NEW.auto_clocked_out = true AND OLD.auto_clocked_out = false)
  EXECUTE FUNCTION ts_create_feed_event('auto_clock_out');

-- ts_breaks triggers
CREATE TRIGGER trg_ts_breaks_insert
  AFTER INSERT ON ts_breaks FOR EACH ROW
  EXECUTE FUNCTION ts_create_feed_event('break_start');

CREATE TRIGGER trg_ts_breaks_end
  AFTER UPDATE OF end_at ON ts_breaks FOR EACH ROW
  WHEN (OLD.end_at IS NULL AND NEW.end_at IS NOT NULL)
  EXECUTE FUNCTION ts_create_feed_event('break_end');

-- ts_shifts triggers
CREATE TRIGGER trg_ts_shifts_insert
  AFTER INSERT ON ts_shifts FOR EACH ROW
  EXECUTE FUNCTION ts_create_feed_event('shift_assigned');

CREATE TRIGGER trg_ts_shifts_cancelled
  AFTER UPDATE OF status ON ts_shifts FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION ts_create_feed_event('shift_cancelled');
```

Note: `ts_breaks` doesn't have `user_id`/`entity_id`/`worker_user_id` directly. The trigger function needs to JOIN to `ts_entries` to get these. Update the trigger function to handle this:

```sql
-- Separate trigger function for ts_breaks (needs entry lookup)
CREATE OR REPLACE FUNCTION ts_create_break_feed_event() RETURNS TRIGGER AS $$
DECLARE
  v_entry ts_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM ts_entries WHERE id = NEW.entry_id;
  INSERT INTO ts_feed_events (
    id, user_id, entity_id, worker_user_id,
    event_type, entry_id, shift_id,
    source_table, source_id, created_at
  ) VALUES (
    gen_random_uuid(),
    v_entry.user_id, v_entry.entity_id, v_entry.worker_user_id,
    TG_ARGV[0], NEW.entry_id, NULL,
    'ts_breaks', NEW.id, NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 1e. Migration runner

File: `apps/28timesheets/database/run-migrations.ts`

```typescript
// Node script, run via: npx tsx database/run-migrations.ts
// 1. Connect to DATABASE_URL
// 2. CREATE TABLE IF NOT EXISTS ts_migration_history (filename VARCHAR PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
// 3. Read all .sql files from database/migrations/ sorted alphabetically
// 4. For each file not in ts_migration_history: run it, insert record
// 5. Log results
```

Add to `package.json` scripts: `"migrate": "npx tsx database/run-migrations.ts"`

### 1f. Core services

**`src/lib/geo.service.ts`:**
```typescript
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
  // Returns distance in metres between two GPS coordinates
  // Standard Haversine formula with Earth radius 6371000m

export function isWithinGeofence(lat: number, lon: number, site: { latitude: number; longitude: number; geofence_radius_metres: number | null }): { within: boolean; distance_metres: number }
  // If site.geofence_radius_metres is null, return { within: true, distance_metres: 0 }
  // Otherwise calculate Haversine distance and compare
```

**`src/lib/settings.service.ts`:**
```typescript
export async function getWorkspaceSettings(userId: string, entityId: string): Promise<TsSettings | null>
  // SELECT * FROM ts_settings WHERE user_id = $1 AND entity_id = $2

export async function upsertWorkspaceSettings(userId: string, entityId: string, data: Partial<TsSettings>): Promise<TsSettings>
  // INSERT ... ON CONFLICT (user_id, entity_id) DO UPDATE

export async function getEffectiveSetting(workerId: string, entityId: string, settingName: string): Promise<any>
  // 1. Check ts_workers override for this worker
  // 2. If null → check ts_sites setting for worker's default site
  // 3. If null → check ts_settings workspace default
  // Returns resolved value

export async function getEffectiveBreakRules(workerId: string, entityId: string): Promise<BreakRule[]>
  // Load workspace break rules, merge worker overrides

export async function getEffectiveOvertimeRules(workerId: string, entityId: string): Promise<OvertimeRule[]>
  // Load workspace overtime rules, merge worker overrides
```

**`src/lib/clock.service.ts`:**
```typescript
export async function clockIn(data: {
  workerId: string; userId: string; entityId: string;
  latitude: number; longitude: number; ip: string;
  device: object; photoUrl?: string; photoHash?: string;
  siteId?: string; projectTag?: string; idempotencyKey?: string;
}): Promise<TsEntry>
  // 1. Check idempotency_key — if exists, return existing entry
  // 2. Check worker isn't already clocked in (ts_entries WHERE worker_user_id = $1 AND clock_out_at IS NULL)
  //    If already clocked in → throw error "Already clocked in"
  // 3. If siteId provided → load site, check geofence via isWithinGeofence()
  //    If outside and strict mode → throw error
  //    If outside and lenient → allow, set is_within_geofence_in = false
  // 4. If photo required (site or workspace setting) and no photoUrl → throw error
  // 5. Check for scheduled shift within allow_early_clock_in_minutes
  //    SELECT * FROM ts_shifts WHERE worker_user_id = $1 AND date = CURRENT_DATE AND status = 'scheduled'
  //    AND start_time BETWEEN NOW() - interval 'X minutes' AND NOW() + interval 'X minutes'
  //    If found → link shift_id, update shift status to 'in_progress'
  // 6. INSERT INTO ts_entries (...) RETURNING *
  //    → trigger fires, creates ts_feed_events row automatically
  // 7. logAudit(...)
  // 8. Return entry

export async function clockOut(data: {
  workerId: string; userId: string; entityId: string;
  latitude: number; longitude: number; ip: string;
  device: object; photoUrl?: string; photoHash?: string;
}): Promise<TsEntry>
  // 1. Find active entry (clock_out_at IS NULL)
  // 2. Set clock_out fields (GPS, IP, device, photo)
  // 3. Check geofence on clock-out
  // 4. Calculate total_break_minutes from SUM of ts_breaks
  // 5. Calculate total_worked_minutes = EXTRACT(EPOCH FROM clock_out - clock_in)/60 - total_break_minutes - deduction_minutes
  // 6. Set status = 'pending_approval'
  // 7. If linked shift → update shift status to 'completed'
  // 8. UPDATE ts_entries SET ... WHERE id = $1 RETURNING *
  //    → trigger fires for clock_out and status_change
  // 9. Return entry

export async function startBreak(data: {
  workerId: string; latitude: number; longitude: number; breakType: 'paid' | 'unpaid';
}): Promise<TsBreak>
  // 1. Find active entry
  // 2. Check no break already in progress (ts_breaks WHERE entry_id = $1 AND end_at IS NULL)
  // 3. INSERT INTO ts_breaks (...) RETURNING *
  //    → trigger fires for break_start

export async function endBreak(data: {
  workerId: string; latitude: number; longitude: number;
}): Promise<TsBreak>
  // 1. Find active break (end_at IS NULL)
  // 2. Calculate duration_minutes
  // 3. UPDATE ts_breaks SET end_at = NOW(), duration_minutes = $1, end_latitude = $2, end_longitude = $3
  //    → trigger fires for break_end
```

**`src/lib/entry.service.ts`:**
```typescript
export async function getActiveEntry(workerId: string, entityId: string): Promise<TsEntry | null>
  // SELECT * FROM ts_entries WHERE worker_user_id = $1 AND entity_id = $2 AND clock_out_at IS NULL

export async function getEntryById(entryId: string, userId: string, entityId: string): Promise<TsEntry | null>
  // SELECT with joins to ts_breaks, ts_gps_pings for full detail

export async function listEntries(filters: {
  userId: string; entityId: string;
  workerId?: string; status?: string; siteId?: string;
  dateFrom?: string; dateTo?: string;
  page?: number; limit?: number;
}): Promise<{ entries: TsEntry[]; total: number }>
  // Paginated SELECT with dynamic WHERE clauses
```

**`src/lib/audit.service.ts`:**
```typescript
export async function logAudit(data: {
  userId: string; entityId: string; actorUserId: string;
  action: string; targetType: string; targetId?: string; details?: object;
}): Promise<void>
  // INSERT INTO ts_audit_log (...) — fire and forget (non-blocking)
```

**`src/lib/worker.service.ts`:**
```typescript
export async function getWorkerConfig(workerUserId: string, entityId: string): Promise<TsWorker | null>
  // SELECT * FROM ts_workers WHERE worker_user_id = $1 AND entity_id = $2

export async function createWorker(data: { userId, entityId, workerUserId, employeeNumber?, hourlyRate?, ... }): Promise<TsWorker>
  // INSERT INTO ts_workers (...) RETURNING *

export async function updateWorker(workerId: string, userId: string, data: Partial<TsWorker>): Promise<TsWorker | null>
  // UPDATE ts_workers SET ... WHERE id = $1 AND user_id = $2 RETURNING *

export async function listWorkers(userId: string, entityId: string): Promise<TsWorker[]>
  // SELECT tw.*, u.full_name, u.email FROM ts_workers tw JOIN users u ON tw.worker_user_id = u.id
  // WHERE tw.user_id = $1 AND tw.entity_id = $2
```

**`src/lib/site.service.ts`:**
```typescript
export async function createSite(data: { userId, entityId, name, address, latitude, longitude, geofenceRadius?, requirePhoto? }): Promise<TsSite>
export async function getSiteById(siteId: string, userId: string, entityId: string): Promise<TsSite | null>
export async function updateSite(siteId: string, userId: string, data: Partial<TsSite>): Promise<TsSite | null>
export async function listSites(userId: string, entityId: string): Promise<TsSite[]>
export async function deactivateSite(siteId: string, userId: string): Promise<boolean>
```

### 1g. Clock API routes

**`app/api/clock/in/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // 1. const auth = await getAuthUser(); if (!auth) return 401
  // 2. const { latitude, longitude, siteId, projectTag, photoUrl, photoHash, idempotencyKey } = await req.json()
  // 3. Validate: latitude (-90 to 90), longitude (-180 to 180) via zod
  // 4. Get IP from req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')
  // 5. Get device from req.headers.get('user-agent') + body.screenSize
  // 6. const entity = await getActiveEntity(auth.userId)
  // 7. const entry = await clockIn({ workerId: auth.userId, userId: auth.userId, entityId: entity.id, ... })
  // 8. return NextResponse.json({ entry }, { status: 201 })
}
```

**`app/api/clock/out/route.ts`:** Same pattern, calls `clockOut()`.

**`app/api/clock/status/route.ts`:**
```typescript
export async function GET() {
  // 1. auth check
  // 2. const entity = await getActiveEntity(auth.userId)
  // 3. const entry = await getActiveEntry(auth.userId, entity.id)
  // 4. If entry exists, also load active break: SELECT * FROM ts_breaks WHERE entry_id = $1 AND end_at IS NULL
  // 5. return NextResponse.json({ entry, activeBreak })
}
```

**`app/api/clock/break/start/route.ts`:** POST, calls `startBreak()`.
**`app/api/clock/break/end/route.ts`:** POST, calls `endBreak()`.

### 1h. Minimal worker UI

**`app/worker/layout.tsx`:** (client component)
```typescript
'use client'
// Import BottomTabBar from @relentify/ui
// Import Clock, ListTodo, FileText icons from lucide-react
// Define staff tabs: Clock In (/worker), My Shifts (/worker/shifts), My Timesheets (/worker/timesheets)
// Render: children + BottomTabBar
```

**`app/worker/page.tsx`:** (client component)
```typescript
'use client'
// The hero screen
// State: { entry, activeBreak, loading, gpsStatus }
// On mount: fetch /api/clock/status
//   If clocked in → show timer (compute from clock_in_at), break button, clock-out button
//   If not clocked in → show big clock-in button

// Clock-in flow:
//   1. Request GPS: navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true })
//   2. Show GPS status: "Getting location..." → "Location: verified" or "Location unavailable"
//   3. If photo required → show camera input
//   4. On button tap → POST /api/clock/in with coords, IP comes from server

// Timer: useEffect with setInterval(1000), displays HH:MM:SS since clock_in_at
// Break button: POST /api/clock/break/start or /end depending on state
// Clock-out button: POST /api/clock/out

// UI uses @relentify/ui Button (variant primary for clock-in, destructive for clock-out)
// Status badge: Card component with MapPin icon + location text
// All colours via theme variables
// Framer Motion: spring.snappy on button press
```

### 1i. Verify Phase 1

1. `cd /opt/relentify-monorepo && pnpm install`
2. Run migrations against local DB via `docker exec -it infra-postgres psql -U relentify_user -d relentify -f -` piping each SQL file
3. `curl -X POST http://localhost:3028/api/clock/in -H 'Cookie: relentify_token=...' -d '{"latitude":51.5,"longitude":-0.1}'`
4. `curl http://localhost:3028/api/clock/status -H 'Cookie: ...'` → returns active entry
5. `curl -X POST http://localhost:3028/api/clock/out -H 'Cookie: ...' -d '{"latitude":51.5,"longitude":-0.1}'`
6. `docker exec -it infra-postgres psql -U relentify_user -d relentify -c "SELECT * FROM ts_feed_events"` → should have rows
7. `pnpm build --filter timesheets` succeeds

### 1j. Commit

`[28timesheets] Phase 1: scaffolding, database, clock in/out core loop`

---

## Phase 2: Sites + Workers + Settings + Team + Quick-Start

**Goal:** Admin manages sites (with geofence map), workers (with per-worker overrides), workspace settings, team invites. Quick-start CSV import for onboarding.

### 2a. Services

**`src/lib/team.service.ts`:**
```typescript
// Copy pattern from apps/22accounting/src/lib/team.service.ts
// Uses workspace_members table (shared with other apps)
// Key functions:
export async function inviteMember(ownerUserId: string, email: string, role: string, permissions: TimesheetPermissions): Promise<{ inviteToken: string }>
  // 1. Check not already invited: SELECT FROM workspace_members WHERE owner_user_id = $1 AND invited_email = $2
  // 2. Generate invite_token (uuid)
  // 3. INSERT INTO workspace_members (owner_user_id, invited_email, permissions, role, invite_token, status) VALUES (...)
  // 4. TODO: send invite email (Phase 9)
  // 5. Return { inviteToken }

export async function acceptInvite(token: string, memberUserId: string, memberEmail: string): Promise<void>
  // UPDATE workspace_members SET member_user_id = $1, status = 'active', accepted_at = NOW() WHERE invite_token = $2

export async function listMembers(ownerUserId: string): Promise<WorkspaceMember[]>
  // SELECT wm.*, u.full_name, u.email FROM workspace_members wm LEFT JOIN users u ON wm.member_user_id = u.id
  // WHERE wm.owner_user_id = $1

export async function updateMemberRole(memberId: string, ownerUserId: string, role: string): Promise<void>
  // UPDATE workspace_members SET role = $1 WHERE id = $2 AND owner_user_id = $3

export async function updateMemberPermissions(memberId: string, ownerUserId: string, permissions: TimesheetPermissions): Promise<void>
  // UPDATE workspace_members SET permissions = $1 WHERE id = $2 AND owner_user_id = $3

export async function getMemberRole(ownerUserId: string, memberUserId: string): Promise<string | null>
  // If ownerUserId === memberUserId return 'owner'
  // SELECT role FROM workspace_members WHERE owner_user_id = $1 AND member_user_id = $2 AND status = 'active'
```

**`src/lib/import.service.ts`:**
```typescript
export async function importWorkersFromCsv(userId: string, entityId: string, csvContent: string): Promise<{ created: number; errors: string[] }>
  // 1. Parse CSV: expect columns name, email, hourly_rate (optional)
  // 2. For each row:
  //    a. Check if user exists by email in users table
  //    b. If not → create user with random password (they'll reset via 21auth)
  //    c. Create workspace_members row with role 'staff', default permissions
  //    d. Create ts_workers row with hourly_rate if provided
  // 3. Return { created: N, errors: [...] }
```

### 2b. API routes

**`app/api/sites/route.ts`:**
```typescript
export async function GET() {
  // auth → entity → listSites(auth.userId, entity.id) → return { sites }
}
export async function POST(req: NextRequest) {
  // auth → checkPermission('sites', 'manage') → entity → validate body → createSite(...) → return { site }, 201
}
```

**`app/api/sites/[id]/route.ts`:**
```typescript
export async function GET(req, { params }) {
  // auth → entity → getSiteById(params.id, auth.userId, entity.id) → return { site }
}
export async function PUT(req, { params }) {
  // auth → checkPermission('sites', 'manage') → entity → validate body → updateSite(...) → return { site }
}
export async function DELETE(req, { params }) {
  // auth → checkPermission('sites', 'manage') → deactivateSite(...) → return { success: true }
}
```

**`app/api/workers/route.ts`:** GET list, POST create. Same pattern.
**`app/api/workers/[id]/route.ts`:** GET single, PUT update.

**`app/api/workers/import/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // auth → checkPermission('team', 'manage')
  // const formData = await req.formData()
  // const file = formData.get('file') as File
  // const csvContent = await file.text()
  // const result = await importWorkersFromCsv(auth.userId, entity.id, csvContent)
  // return NextResponse.json(result)
}
```

**`app/api/settings/route.ts`:** GET + PUT. GET requires view permission, PUT requires manage.
**`app/api/team/route.ts`:** GET list, POST invite.
**`app/api/team/[id]/role/route.ts`:** PUT — checkPermission('team', 'manage').
**`app/api/team/[id]/permissions/route.ts`:** PUT — checkPermission('team', 'manage').

### 2c. UI pages

**`app/sites/page.tsx`:**
- List view: Card per site showing name, address, geofence radius, photo requirement badge
- "Add Site" button → modal/sheet with form: name, address, lat/lon (manual input or "Use map"), geofence radius slider (50m-2000m), require photo toggle
- For V1: manual lat/lon input. Future: map picker
- Delete = deactivate (soft delete)

**`app/sites/[id]/page.tsx`:**
- Edit form matching create form
- Shows map with circle overlay at geofence radius (using a simple `<img>` with OpenStreetMap static tile for V1)

**`app/workers/page.tsx`:**
- List of workers: name, email, employee number, hourly rate, employment type, status (active/inactive)
- "Add Worker" button → modal with form
- "Import CSV" button → file upload → calls `/api/workers/import`
- Quick-start banner at top if <3 workers: "Get your team started — import a CSV or add workers one by one"

**`app/workers/[id]/page.tsx`:**
- Worker detail with tabs: Profile, Config, History
- Config tab: hourly rate, contracted hours, employment type, default site (dropdown from sites), overtime rate override, allowed sites (multi-select), break rule overrides, GPS ping override, photo requirement override

**`app/settings/page.tsx`:**
- Sections matching `ts_settings` columns:
  - GPS: require GPS toggle, ping interval dropdown (15/30/60/checkpoints only)
  - Photos: require photo toggle
  - Auto Clock-Out: enabled toggle, max hours input, at shift end toggle, deduction mode dropdown (flag_for_review/auto/none), deduction type dropdown (fixed/dynamic), fixed deduction minutes input
  - Shifts: project tag required toggle, early clock-in window input, late clock-out window input
  - Data Retention: GPS retention days input, photo retention days input

**`app/team/page.tsx`:**
- List of team members: name, email, role badge, status (active/pending)
- "Invite" button → modal: email input, role dropdown (admin/manager/staff/viewer)
- Click member → permission matrix (6 modules × actions, checkboxes)
- Role change dropdown per member

### 2d. Responsive layout

Create `app/(admin)/layout.tsx` — shared layout for all admin-facing pages (sites, workers, settings, team, overtime-rules, break-rules, audit):
- Desktop (>1024px): CollapsibleSidebar with groups: Clock In, Feed, Schedule, Approvals, Dashboard, Reports, then Settings group (Sites, Workers, Team, Overtime Rules, Break Rules, Settings, Audit)
- Mobile (<1024px): BottomTabBar with manager/admin tabs + "More" tab that opens a Sheet with full menu

### 2e. Verify Phase 2

1. Create site with geofence radius 200m via UI
2. Create worker via UI, assign to site
3. Clock in from within 200m → `is_within_geofence_in = true`
4. Clock in from 500m away → flagged or rejected depending on settings
5. Upload CSV with 3 workers → all created with default permissions
6. Update workspace settings → verify persist on reload
7. Invite team member → verify workspace_members row created
8. Change member role → verify updated

### 2f. Commit

`[28timesheets] Phase 2: sites, workers, settings, team, CSV import`

---

## Phase 3: Shifts + Scheduling

**Goal:** Managers schedule shifts and assign workers. Workers see upcoming shifts. Clock-in auto-links to scheduled shifts.

### 3a. Services

**`src/lib/shift.service.ts`:**
```typescript
export async function createShift(data: {
  userId, entityId, workerUserId, siteId?, date, startTime, endTime, notes?, templateId?
}): Promise<TsShift>
  // 1. Check for conflicts: SELECT FROM ts_shifts WHERE worker_user_id = $1 AND date = $2 AND status != 'cancelled'
  //    AND (start_time, end_time) OVERLAPS ($3, $4)
  //    If conflict → throw error
  // 2. INSERT INTO ts_shifts (...) RETURNING *
  //    → trigger fires, creates 'shift_assigned' feed event
  // 3. logAudit(...)

export async function bulkCreateShifts(data: {
  userId, entityId, templateId, workerUserIds: string[], dateFrom, dateTo
}): Promise<TsShift[]>
  // 1. Load template for recurrence rules
  // 2. Generate dates in range matching recurrence (e.g. Mon-Fri)
  // 3. For each date × each worker: createShift()
  // 4. Return all created shifts

export async function listShifts(filters: {
  userId, entityId, workerId?, siteId?, dateFrom?, dateTo?, status?, page?, limit?
}): Promise<{ shifts: TsShift[]; total: number }>
  // Paginated SELECT with joins to users (worker name) and ts_sites (site name)

export async function getWorkerShifts(workerId: string, entityId: string, dateFrom?: string): Promise<TsShift[]>
  // SELECT * FROM ts_shifts WHERE worker_user_id = $1 AND entity_id = $2
  // AND date >= COALESCE($3, CURRENT_DATE) AND status != 'cancelled'
  // ORDER BY date, start_time

export async function cancelShift(shiftId: string, userId: string, reason?: string): Promise<void>
  // UPDATE ts_shifts SET status = 'cancelled' WHERE id = $1 AND user_id = $2
  // → trigger fires 'shift_cancelled'
  // logAudit(...)

export async function updateShift(shiftId: string, userId: string, data: Partial<TsShift>): Promise<TsShift | null>
  // UPDATE ts_shifts SET ... WHERE id = $1 AND user_id = $2 RETURNING *
```

**`src/lib/shift-template.service.ts`:**
```typescript
export async function createTemplate(data: { userId, entityId, siteId?, name, startTime, endTime, breakMinutes, isPaidBreak, recurrence }): Promise<TsShiftTemplate>
export async function listTemplates(userId: string, entityId: string): Promise<TsShiftTemplate[]>
export async function updateTemplate(templateId: string, userId: string, data: Partial<TsShiftTemplate>): Promise<TsShiftTemplate | null>
export async function deleteTemplate(templateId: string, userId: string): Promise<boolean>
```

### 3b. Update clock.service.ts

In `clockIn()`, add shift-linking logic after step 4:
```typescript
// 5. Check for scheduled shift within early clock-in window
const settings = await getWorkspaceSettings(userId, entityId)
const earlyWindow = settings?.allow_early_clock_in_minutes || 15
const matchingShift = await query(
  `SELECT * FROM ts_shifts
   WHERE worker_user_id = $1 AND entity_id = $2 AND date = CURRENT_DATE AND status = 'scheduled'
   AND start_time BETWEEN NOW() - interval '${earlyWindow} minutes' AND NOW() + interval '${earlyWindow} minutes'
   LIMIT 1`,
  [workerId, entityId]
)
// If found: set shift_id on entry, update shift status to 'in_progress'
```

### 3c. API routes

| File | Methods | Auth |
|------|---------|------|
| `app/api/shifts/route.ts` | GET list, POST create | GET: scheduling.view, POST: scheduling.create |
| `app/api/shifts/[id]/route.ts` | GET, PUT, DELETE (cancel) | PUT/DELETE: scheduling.create |
| `app/api/shifts/bulk-create/route.ts` | POST | scheduling.create |
| `app/api/shifts/my/route.ts` | GET worker's own upcoming | timesheets.view (own data) |
| `app/api/shift-templates/route.ts` | GET, POST | scheduling.view / scheduling.create |
| `app/api/shift-templates/[id]/route.ts` | PUT, DELETE | scheduling.create |

### 3d. UI pages

**`app/schedule/page.tsx`:**
- Calendar view: week default, toggle day/month via tabs
- Each day column shows shifts as coloured blocks (colour = site)
- Click empty slot → create shift modal: worker dropdown, site dropdown, date, start/end time, notes
- Click existing shift → edit/cancel
- "Bulk Create" button → template picker + date range + worker multi-select
- Responsive: on mobile, show day view by default (single column)

**`app/worker/shifts/page.tsx`:**
- Card list of upcoming shifts
- Each card: date, time range, site name, notes
- "Clock In" shortcut button on cards within the early window
- Past shifts greyed out with status badge (completed/cancelled)

### 3e. Verify Phase 3

1. Create shift template "Morning Shift" 08:00-17:00 Mon-Fri
2. Bulk create shifts for 2 workers across next week
3. Worker views `/worker/shifts` → sees 5 upcoming shifts
4. Worker clocks in at 07:50 → auto-links to 08:00 shift
5. Worker clocks out → shift status changes to 'completed'
6. Manager cancels a shift → worker sees 'cancelled' in feed
7. Conflict detection: try creating overlapping shift → error

### 3f. Commit

`[28timesheets] Phase 3: shifts, scheduling, templates, shift linking`

---

## Phase 4: Approval Workflow

**Goal:** Managers approve/reject timesheet entries. Bulk operations. Locking after approval. Workers view their history.

### 4a. Service

**`src/lib/approval.service.ts`:**
```typescript
export async function approveEntry(entryId: string, approverUserId: string, userId: string, entityId: string): Promise<TsEntry>
  // 1. SELECT * FROM ts_entries WHERE id = $1 AND user_id = $2 AND entity_id = $3
  // 2. Check status = 'pending_approval' → else error "Can only approve pending entries"
  // 3. Check approver has 'timesheets.approve' permission
  // 4. UPDATE ts_entries SET status = 'approved', approved_by = $1, approved_at = NOW()
  //    → trigger fires 'status_change' feed event
  // 5. Check if workspace auto-locks → if yes, set status = 'locked'
  // 6. logAudit('entry.approved', ...)
  // 7. Return updated entry

export async function rejectEntry(entryId: string, approverUserId: string, userId: string, entityId: string, reason: string): Promise<TsEntry>
  // Same checks as approve
  // UPDATE ts_entries SET status = 'rejected', rejection_reason = $1
  // logAudit('entry.rejected', ...)

export async function bulkApprove(entryIds: string[], approverUserId: string, userId: string, entityId: string): Promise<{ approved: number; errors: string[] }>
  // Use withTransaction:
  //   For each entryId: validate status, UPDATE
  //   If any fails: collect error, continue (don't rollback all)
  // Return count + errors

export async function bulkReject(entryIds: string[], approverUserId: string, userId: string, entityId: string, reason: string): Promise<{ rejected: number; errors: string[] }>
  // Same pattern as bulkApprove

export async function lockEntry(entryId: string, userId: string, entityId: string): Promise<TsEntry>
  // Check status = 'approved'
  // UPDATE SET status = 'locked'
  // Locked entries: only admin can edit, with audit trail
```

### 4b. API routes

| File | Methods | Permission |
|------|---------|------------|
| `app/api/entries/route.ts` | GET list | timesheets.view |
| `app/api/entries/[id]/route.ts` | GET, PUT, DELETE | PUT: manager+ or worker if pending. DELETE: admin only, not if locked |
| `app/api/entries/[id]/approve/route.ts` | POST | timesheets.approve |
| `app/api/entries/[id]/reject/route.ts` | POST | timesheets.approve |
| `app/api/entries/[id]/lock/route.ts` | POST | timesheets.approve |
| `app/api/entries/bulk-approve/route.ts` | POST { entryIds } | timesheets.approve |
| `app/api/entries/bulk-reject/route.ts` | POST { entryIds, reason } | timesheets.approve |

**GET `/api/entries`** supports query params: `workerId`, `status`, `siteId`, `dateFrom`, `dateTo`, `page`, `limit`. Manager sees only their team's entries (filter by `ts_workers.manager_user_id`). Staff sees only own.

### 4c. UI pages

**`app/approvals/page.tsx`:**
- Pending entries as card list, sorted by date DESC
- Each card: worker avatar + name, date, clock-in → clock-out times, total hours, site name, trust score badge (green/amber/red), photo thumbnail (if present), flag icons (outside geofence, auto clocked out, overtime, missed break)
- Mobile: swipe right = approve (green flash), swipe left = reject (red flash, shows reason input)
- Desktop: checkbox select + "Approve Selected" / "Reject Selected" buttons at top
- Filter bar: date range, worker dropdown, site dropdown, "flagged only" toggle
- Badge on nav showing pending count

**`app/worker/timesheets/page.tsx`:**
- Worker's own entries, filterable by week/month (date range picker)
- Card list: date, hours worked, breaks taken, overtime, status badge
- Totals row at bottom: total hours this period, total overtime, total breaks

**`app/worker/timesheets/[id]/page.tsx`:**
- Full entry detail:
  - Clock-in/out times with GPS coordinates
  - Map showing clock-in and clock-out pins (static map image from OpenStreetMap)
  - Break timeline
  - GPS pings list (Phase 6 will populate)
  - Trust score breakdown
  - Status with approval details (who approved, when)
  - Deductions if any, with reason
  - Comment thread (Phase 7 will add)

### 4d. Verify Phase 4

1. Clock out → entry status = `pending_approval`
2. Manager approves → status = `approved`, approved_by + approved_at set
3. Manager rejects with reason → status = `rejected`, rejection_reason set
4. Bulk approve 3 entries → all approved
5. Lock approved entry → status = `locked`
6. Try editing locked entry as manager → 403
7. Try deleting locked entry as admin → success with audit trail
8. Worker views own timesheets → sees correct status badges

### 4e. Commit

`[28timesheets] Phase 4: approval workflow, bulk approve/reject, locking`

---

## Phase 5: Overtime + Break Rules + Auto Clock-Out + Trust Score

**Goal:** Configurable rules engine. Per-worker overrides. Auto clock-out cron with GPS-based deductions. Trust score computation.

### 5a. Services

**`src/lib/overtime.service.ts`:**
```typescript
export async function calculateOvertime(workerId: string, entityId: string, date: string): Promise<void>
  // 1. Load effective overtime rules via getEffectiveOvertimeRules(workerId, entityId)
  // 2. Sort by priority (higher first)
  // 3. Load all entries for the relevant periods:
  //    - Daily rules: entries for this date
  //    - Weekly rules: entries for this ISO week
  //    - Consecutive day: entries for last N days
  // 4. For each rule in priority order:
  //    - Daily: if sum(total_worked_minutes) for date > threshold → overtime = sum - threshold
  //    - Weekly: if sum(total_worked_minutes) for week > threshold → overtime = sum - threshold, distribute across entries
  //    - Night: check if any entry hours fall within night window (e.g. after 21:00) → apply multiplier
  //    - Consecutive day: if worked N+ consecutive days → apply rule
  //    - Holiday: check against holiday list in conditions JSONB → apply multiplier
  // 5. UPDATE ts_entries SET overtime_minutes = calculated value for each affected entry
  // 6. If any threshold newly crossed → the trigger will create feed event via status/overtime update

export async function createOvertimeRule(data: { userId, entityId, name, ruleType, thresholdMinutes, multiplier, conditions?, priority }): Promise<TsOvertimeRule>
  // INSERT INTO ts_overtime_rules (...) RETURNING *
  // logAudit(...)

export async function listOvertimeRules(userId: string, entityId: string): Promise<TsOvertimeRule[]>
export async function updateOvertimeRule(ruleId: string, userId: string, data: Partial<TsOvertimeRule>): Promise<TsOvertimeRule | null>
export async function deleteOvertimeRule(ruleId: string, userId: string): Promise<boolean>
```

**`src/lib/break-rules.service.ts`:**
```typescript
export async function evaluateBreakCompliance(entryId: string): Promise<{ compliant: boolean; deductedMinutes: number }>
  // 1. Load entry
  // 2. Load effective break rules via getEffectiveBreakRules(entry.worker_user_id, entry.entity_id)
  // 3. Load breaks for this entry: SELECT * FROM ts_breaks WHERE entry_id = $1
  // 4. For each rule:
  //    - If total_worked_minutes > after_worked_minutes:
  //      - Check if worker took a break >= break_duration_minutes of the correct type
  //      - If not and auto_deduct = true:
  //        - Add break_duration_minutes to total_break_minutes on entry
  //        - Update total_worked_minutes accordingly
  //        - Return { compliant: false, deductedMinutes: break_duration_minutes }
  //      - If not and auto_deduct = false:
  //        - Just flag (feed event via audit)
  // 5. Return { compliant: true, deductedMinutes: 0 } if all rules satisfied

export async function createBreakRule(data: { userId, entityId, name, afterWorkedMinutes, breakDurationMinutes, breakType, autoDeduct }): Promise<TsBreakRule>
export async function listBreakRules(userId: string, entityId: string): Promise<TsBreakRule[]>
export async function updateBreakRule(ruleId: string, userId: string, data: Partial<TsBreakRule>): Promise<TsBreakRule | null>
export async function deleteBreakRule(ruleId: string, userId: string): Promise<boolean>
```

**`src/lib/auto-clock-out.service.ts`:**
```typescript
export async function processAutoClockOuts(): Promise<{ processed: number; deductions: number }>
  // 1. Find all active entries (clock_out_at IS NULL):
  //    SELECT te.*, ts.end_time as shift_end, tset.* FROM ts_entries te
  //    LEFT JOIN ts_shifts ts ON te.shift_id = ts.id
  //    LEFT JOIN ts_settings tset ON te.user_id = tset.user_id AND te.entity_id = tset.entity_id
  //    WHERE te.clock_out_at IS NULL
  //
  // 2. For each entry, check trigger conditions:
  //    a. Past shift end AND auto_clock_out_at_shift_end = true
  //    b. Past max hours: EXTRACT(EPOCH FROM NOW() - clock_in_at)/60 > auto_clock_out_after_minutes
  //
  // 3. If triggered:
  //    a. Get effective deduction_mode for this worker (worker override → workspace)
  //    b. Get last GPS ping inside geofence:
  //       SELECT * FROM ts_gps_pings WHERE entry_id = $1 AND is_within_geofence = true
  //       ORDER BY captured_at DESC LIMIT 1
  //    c. Apply deduction:
  //       - mode = 'auto', type = 'dynamic': deduction = minutes from last_in_fence_ping to now
  //       - mode = 'auto', type = 'fixed': deduction = fixed_deduction_minutes from settings
  //       - mode = 'flag_for_review': deduction = 0, but log audit event
  //       - mode = 'none': deduction = 0
  //    d. UPDATE ts_entries SET
  //         clock_out_at = NOW(),
  //         auto_clocked_out = true,
  //         deduction_minutes = calculated,
  //         deduction_reason = 'Auto clock-out: [reason]',
  //         total_worked_minutes = calculated,
  //         status = 'pending_approval'
  //       → triggers fire: clock_out, auto_clock_out, status_change
  //    e. evaluateBreakCompliance(entryId)
  //    f. calculateOvertime(workerId, date)
  //    g. calculateTrustScore(entryId)
  //    h. logAudit(...)
  //
  // 4. Return { processed: count, deductions: total_deduction_minutes }
```

**`src/lib/trust-score.service.ts`:**
```typescript
export async function calculateTrustScore(entryId: string): Promise<number>
  // Load entry
  // Score starts at 0
  // +25: is_within_geofence_in = true
  // +25: is_within_geofence_out = true (or null if still clocked in)
  // +15: clock_in_photo_url IS NOT NULL (photo present)
  //   -20: if photo hash matches recent photo (reuse detected)
  // +10: IP consistent (same /24 subnet as last 5 entries for this worker)
  // +10: device consistent (same user agent as last 5 entries)
  // +10: gps_verification_pct >= 80 (most pings inside geofence)
  // +5: GPS accuracy < 50m on clock-in
  // Cap at 100
  //
  // UPDATE ts_entries SET trust_score = calculated WHERE id = $1
  // Return score
```

### 5b. Update clock.service.ts

In `clockOut()`, after calculating total_worked_minutes:
```typescript
// Add after step 5:
await evaluateBreakCompliance(entry.id)
await calculateOvertime(workerId, entry.clock_in_at.toISOString().split('T')[0])
await calculateTrustScore(entry.id)
```

### 5c. Cron API routes

**`app/api/cron/auto-clock-out/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // 1. Verify x-cron-secret header matches CRON_SECRET env var
  // 2. const result = await processAutoClockOuts()
  // 3. return NextResponse.json({ ...result, timestamp: new Date().toISOString() })
}
```

**`app/api/cron/overtime-calculation/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // 1. Verify cron secret
  // 2. Get yesterday's date (midnight cron recalculates previous day)
  // 3. Get all workers who had entries yesterday
  // 4. For each worker: calculateOvertime(workerId, yesterday)
  // 5. Return { workersProcessed, overtimeEntries }
}
```

### 5d. CRUD API routes

| File | Methods |
|------|---------|
| `app/api/overtime-rules/route.ts` | GET list, POST create (admin+) |
| `app/api/overtime-rules/[id]/route.ts` | PUT update, DELETE delete (admin+) |
| `app/api/break-rules/route.ts` | GET list, POST create (admin+) |
| `app/api/break-rules/[id]/route.ts` | PUT update, DELETE delete (admin+) |

### 5e. UI pages

**`app/overtime-rules/page.tsx`:**
- Card list of rules, ordered by priority
- Each card: name, type badge (daily/weekly/night/consecutive/holiday), threshold display (e.g. "After 8h daily"), multiplier (e.g. "1.5x"), active/inactive toggle
- "Add Rule" button → modal with form:
  - Name input
  - Type dropdown: daily, weekly, consecutive_day, holiday, night
  - Threshold input (hours/minutes, label changes by type)
  - Multiplier input (decimal, e.g. 1.5)
  - Conditions (shown by type): day-of-week picker for consecutive, time range for night, holiday date list
  - Priority input (integer, drag to reorder)
- Drag to reorder priority on desktop

**`app/break-rules/page.tsx`:**
- Card list of rules
- Each card: name, "After X hours → Y min break (paid/unpaid)", auto-deduct badge
- "Add Rule" button → modal:
  - Name input
  - After worked (hours input, stored as minutes)
  - Break duration (minutes input)
  - Break type toggle: paid / unpaid
  - Auto-deduct toggle with explainer: "If worker doesn't take this break, automatically deduct the break time from their hours"

### 5f. Edge case handling

Update `clock.service.ts` clockIn():
- **No GPS permission**: If latitude/longitude are 0/null, set `is_within_geofence_in = null`, continue. Trust score will be 0.
- **Overlapping shifts**: Already checked in step 2 (reject if active entry exists).
- **Tab duplication**: `idempotency_key` UNIQUE constraint on INSERT. If conflict, SELECT existing entry and return it.

### 5g. Verify Phase 5

1. Create daily overtime rule: threshold 480 mins (8h), multiplier 1.5
2. Create break rule: after 360 mins (6h), auto-deduct 30 mins unpaid
3. Worker works 10 hours straight (no breaks) → clock out:
   - `overtime_minutes = 120`
   - `total_break_minutes = 30` (auto-deducted)
   - `total_worked_minutes = 570` (600 - 30)
4. Auto clock-out cron: create entry, wait, trigger cron → entry auto clocked out with deduction
5. Trust score: clock in with GPS + photo → score ~75-100. Clock in without GPS → score 0.
6. Idempotency: POST clock/in twice with same key → same entry returned

### 5h. Commit

`[28timesheets] Phase 5: overtime rules, break rules, auto clock-out, trust score`

---

## Phase 6: GPS Pings + Photo Verification

**Goal:** Periodic GPS tracking during active shifts. Photo capture with hash-based reuse detection. Data retention cron.

### 6a. Services

**`src/lib/gps.service.ts`:**
```typescript
export async function recordPing(entryId: string, data: {
  latitude: number; longitude: number; accuracy: number; source: string;
}): Promise<TsGpsPing>
  // 1. Load entry to get site_id
  // 2. If entry has site → load site, check geofence
  // 3. INSERT INTO ts_gps_pings (entry_id, latitude, longitude, accuracy_metres, is_within_geofence, captured_at, source)
  // 4. Update summary fields on entry:
  //    UPDATE ts_entries SET
  //      gps_ping_count = gps_ping_count + 1,
  //      gps_pings_in_fence = gps_pings_in_fence + CASE WHEN is_within THEN 1 ELSE 0 END,
  //      gps_verification_pct = (gps_pings_in_fence * 100.0) / gps_ping_count
  //    WHERE id = $1
  // 5. Check for geofence transitions:
  //    - Get previous ping: SELECT is_within_geofence FROM ts_gps_pings WHERE entry_id = $1 ORDER BY captured_at DESC LIMIT 1 OFFSET 1
  //    - If previous was true and current is false → logAudit('left_geofence')
  //    - If previous was false and current is true → logAudit('returned_to_geofence')
  // 6. Return ping

export async function getEntryPings(entryId: string): Promise<TsGpsPing[]>
  // SELECT * FROM ts_gps_pings WHERE entry_id = $1 ORDER BY captured_at ASC
```

**`src/lib/photo.service.ts`:**
```typescript
export async function storePhoto(entryId: string, photoType: 'clock_in' | 'clock_out', imageBuffer: Buffer): Promise<{ photoUrl: string; hash: string; reuseDetected: boolean }>
  // 1. Compute SHA-256 hash of imageBuffer
  // 2. Check for reuse: SELECT id FROM ts_photos WHERE hash = $1
  //    AND entry_id IN (SELECT id FROM ts_entries WHERE worker_user_id = (SELECT worker_user_id FROM ts_entries WHERE id = $2))
  //    AND created_at > NOW() - INTERVAL '30 days'
  //    If found → reuseDetected = true
  // 3. INSERT INTO ts_photos (entry_id, photo_type, hash, size_bytes) RETURNING id
  // 4. INSERT INTO ts_photo_data (photo_id, data) VALUES ($1, $2)
  // 5. Construct photoUrl: /api/photos/{photoId}
  // 6. Update entry: UPDATE ts_entries SET clock_in_photo_url = $1, clock_in_photo_hash = $2 WHERE id = $3
  //    (or clock_out_photo_url/hash)
  // 7. If reuseDetected → logAudit('photo_reuse_detected', ...)
  // 8. Return { photoUrl, hash, reuseDetected }

export async function getPhoto(photoId: string): Promise<Buffer | null>
  // SELECT data FROM ts_photo_data WHERE photo_id = $1

export async function purgeExpiredPhotos(retentionDays: number): Promise<number>
  // DELETE FROM ts_photo_data WHERE photo_id IN (
  //   SELECT id FROM ts_photos WHERE created_at < NOW() - INTERVAL '$1 days'
  // )
  // DELETE FROM ts_photos WHERE created_at < NOW() - INTERVAL '$1 days'
  // Return count deleted
```

### 6b. API routes

**`app/api/gps/ping/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // auth → validate { latitude, longitude, accuracy, source }
  // Get active entry for this worker
  // If no active entry → return 400 "Not clocked in"
  // await recordPing(entry.id, { latitude, longitude, accuracy, source })
  // return NextResponse.json({ recorded: true })
}
```

**`app/api/photos/upload/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // auth
  // const formData = await req.formData()
  // const file = formData.get('photo') as File
  // const photoType = formData.get('type') as 'clock_in' | 'clock_out'
  // const entryId = formData.get('entryId') as string
  // Validate: file size < 5MB, type is image/jpeg or image/png
  // const buffer = Buffer.from(await file.arrayBuffer())
  // const result = await storePhoto(entryId, photoType, buffer)
  // return NextResponse.json(result)
}
```

**`app/api/photos/[id]/route.ts`:**
```typescript
export async function GET(req, { params }) {
  // auth (or token-based for thumbnails)
  // const buffer = await getPhoto(params.id)
  // return new Response(buffer, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=3600' } })
}
```

**`app/api/cron/data-retention/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // Verify cron secret
  // 1. Get all workspace settings (grouped by user_id + entity_id)
  // 2. For each workspace:
  //    a. Delete GPS pings older than gps_retention_days:
  //       DELETE FROM ts_gps_pings WHERE entry_id IN (
  //         SELECT id FROM ts_entries WHERE user_id = $1 AND entity_id = $2
  //       ) AND captured_at < NOW() - INTERVAL '$3 days'
  //    b. Delete photos older than photo_retention_days via purgeExpiredPhotos()
  // 3. Return { pingsDeleted, photosDeleted }
}
```

### 6c. Update clock-in UI

Update `app/worker/page.tsx`:

**GPS periodic pings:**
```typescript
// After successful clock-in, start watchPosition:
useEffect(() => {
  if (!entry) return // not clocked in
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords
      // Only record if position changed by >50m from last ping
      // POST /api/gps/ping { latitude, longitude, accuracy, source: 'low_accuracy' }
    },
    null,
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
  )
  return () => navigator.geolocation.clearWatch(watchId)
}, [entry])
```

**Photo capture:**
```typescript
// If photo required (from settings or site config):
// Show camera input before clock-in button
<input
  type="file"
  accept="image/*"
  capture="user"
  onChange={async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Compress to <500KB using canvas
    // Store compressed blob in state
    // Upload fires in parallel with clock-in
  }}
/>
```

### 6d. Verify Phase 6

1. Clock in → GPS pings start recording (check ts_gps_pings table)
2. Take selfie on clock-in → photo stored in ts_photos + ts_photo_data, hash saved on entry
3. Clock in again with same photo → `reuseDetected: true` in response, trust score reduced
4. GPS pings while clocked in → `gps_ping_count`, `gps_pings_in_fence`, `gps_verification_pct` updated on entry
5. Leave geofence (simulate with API call) → audit log shows 'left_geofence'
6. Run data retention cron → old pings/photos deleted, entry summary fields preserved

### 6e. Commit

`[28timesheets] Phase 6: GPS pings, photo verification, hash reuse detection, data retention`

---

## Phase 7: Activity Feed + Comments

**Goal:** The feed screen — reverse-chronological activity stream with inline comment threads. This is the home screen for managers.

### 7a. Services

**`src/lib/feed.service.ts`:**
```typescript
export async function getFeed(params: {
  userId: string; entityId: string; role: string;
  workerId?: string; // filter to specific worker
  page?: number; limit?: number;
}): Promise<{ events: FeedEvent[]; total: number; hasMore: boolean }>
  // Build query:
  // SELECT
  //   fe.id, fe.event_type, fe.created_at, fe.source_table, fe.source_id,
  //   fe.worker_user_id, fe.entry_id, fe.shift_id,
  //   u.full_name as worker_name,
  //   -- Entry data (joined)
  //   e.clock_in_at, e.clock_out_at, e.status as entry_status,
  //   e.trust_score, e.total_worked_minutes, e.overtime_minutes,
  //   e.deduction_minutes, e.deduction_reason, e.auto_clocked_out,
  //   e.is_within_geofence_in, e.is_within_geofence_out,
  //   e.clock_in_photo_url, e.clock_out_photo_url,
  //   -- Shift data (joined)
  //   s.date as shift_date, s.start_time as shift_start, s.end_time as shift_end,
  //   -- Site name
  //   site.name as site_name,
  //   -- Comment count
  //   (SELECT COUNT(*) FROM ts_comments c WHERE c.entry_id = fe.entry_id AND c.feed_event_type = fe.event_type) as comment_count,
  //   -- Has unread comments (for current user)
  //   EXISTS(SELECT 1 FROM ts_comments c WHERE c.entry_id = fe.entry_id AND c.feed_event_type = fe.event_type
  //     AND c.author_user_id != $currentUserId AND c.created_at > COALESCE(
  //       (SELECT MAX(created_at) FROM ts_comments WHERE entry_id = fe.entry_id AND feed_event_type = fe.event_type AND author_user_id = $currentUserId),
  //       '1970-01-01'::timestamptz
  //     )) as has_unread
  // FROM ts_feed_events fe
  // LEFT JOIN ts_entries e ON fe.entry_id = e.id
  // LEFT JOIN ts_shifts s ON fe.shift_id = s.id
  // LEFT JOIN users u ON fe.worker_user_id = u.id
  // LEFT JOIN ts_sites site ON e.site_id = site.id
  // WHERE fe.entity_id = $1
  //
  // Role scoping:
  //   staff: AND fe.worker_user_id = $currentUserId
  //   manager: AND fe.worker_user_id IN (SELECT worker_user_id FROM ts_workers WHERE manager_user_id = $currentUserId AND entity_id = $1)
  //   admin/owner/viewer: no additional filter
  //
  // ORDER BY fe.created_at DESC
  // LIMIT $limit OFFSET ($page - 1) * $limit
```

**`src/lib/comment.service.ts`:**
```typescript
export async function createComment(data: {
  userId: string; entityId: string; entryId: string;
  feedEventType: string; authorUserId: string; body: string;
}): Promise<TsComment>
  // INSERT INTO ts_comments (...) RETURNING *
  // logAudit('comment.created', ...)

export async function getComments(entryId: string, feedEventType: string): Promise<TsComment[]>
  // SELECT c.*, u.full_name as author_name
  // FROM ts_comments c JOIN users u ON c.author_user_id = u.id
  // WHERE c.entry_id = $1 AND c.feed_event_type = $2
  // ORDER BY c.created_at ASC
```

### 7b. API routes

**`app/api/feed/route.ts`:**
```typescript
export async function GET(req: NextRequest) {
  // auth → entity → get role from workspace_members
  // Parse query params: page, limit, workerId (optional filter)
  // const feed = await getFeed({ userId: auth.userId, entityId: entity.id, role, workerId, page, limit })
  // return NextResponse.json(feed)
}
```

**`app/api/comments/route.ts`:**
```typescript
export async function GET(req: NextRequest) {
  // auth → parse query: entryId, feedEventType
  // const comments = await getComments(entryId, feedEventType)
  // return NextResponse.json({ comments })
}

export async function POST(req: NextRequest) {
  // auth → entity → parse body: entryId, feedEventType, body
  // Validate body not empty, max 1000 chars
  // const comment = await createComment({ userId: auth.userId, entityId: entity.id, entryId, feedEventType, authorUserId: auth.userId, body })
  // return NextResponse.json({ comment }, { status: 201 })
}
```

### 7c. UI

**`app/feed/page.tsx`:** (client component)
```
// State: feedEvents[], loading, page
// On mount: fetch /api/feed?page=1&limit=20
// Pull to refresh: re-fetch page 1
// Infinite scroll: on scroll bottom, fetch next page

// Each feed event renders as a Card:
//   - Left: worker avatar (first letter of name)
//   - Middle: event description text (generated from event_type + joined data)
//     e.g. "James clocked in at 07:58 — Oak Road — Location verified"
//     e.g. "Lisa's timesheet rejected — 'GPS outside geofence'"
//     e.g. "Auto clock-out: Sarah — 25 min deduction (last seen on site at 16:35)"
//   - Right: timestamp (relative: "2 min ago", "1h ago")
//   - Bottom-right: comment count badge (if > 0), red dot if unread
//
// Tap/click event → expand inline (AnimatePresence + height animation):
//   - Show full event details (trust score, GPS coords, photo thumbnail)
//   - Comment thread: list of comments with author name + timestamp
//   - Text input at bottom for new comment
//   - Submit button → POST /api/comments → optimistic update

// Colour coding:
//   - Green border-left: verified/approved (trust_score >= 80 or status approved)
//   - Amber: pending/flagged (trust_score 50-79 or status pending)
//   - Red: rejected/violation (trust_score < 50 or status rejected)
```

### 7d. Verify Phase 7

1. Clock in/out → feed events appear (check UI loads)
2. Manager sees team events. Staff sees only own.
3. Manager taps event → expand → sees details
4. Manager types comment → submit → comment appears in thread
5. Worker opens feed → sees red dot on events with manager comments
6. Worker replies → manager sees updated comment count
7. Pagination: scroll down → next page loads
8. Rejection comment thread: reject entry with reason → worker sees in feed → replies → manager sees

### 7e. Commit

`[28timesheets] Phase 7: activity feed, comment threads, role-scoped events`

---

## Phase 8: Dashboard + Reports

**Goal:** Live dashboard (list-first, optional map). Reports with CSV/PDF export. Payroll-ready summary. Wage leakage report.

### 8a. Services

**`src/lib/dashboard.service.ts`:**
```typescript
export async function getLiveStatus(userId: string, entityId: string): Promise<{
  clockedIn: Array<{ workerId, workerName, siteId, siteName, clockInAt, duration, isOnBreak, isWithinGeofence, trustScore }>;
  onBreak: number;
  totalClockedIn: number;
  unverifiedLocations: number;
}>
  // SELECT te.*, u.full_name, s.name as site_name,
  //   EXISTS(SELECT 1 FROM ts_breaks WHERE entry_id = te.id AND end_at IS NULL) as is_on_break
  // FROM ts_entries te
  // JOIN users u ON te.worker_user_id = u.id
  // LEFT JOIN ts_sites s ON te.site_id = s.id
  // WHERE te.user_id = $1 AND te.entity_id = $2 AND te.clock_out_at IS NULL

export async function getDailySummary(userId: string, entityId: string, date: string): Promise<{
  totalHours: number; totalOvertime: number; totalDeductions: number;
  pendingApprovals: number; missedShifts: number; overtimeAlerts: number;
}>
  // Aggregate queries across ts_entries and ts_shifts for the given date
```

**`src/lib/reports.service.ts`:**
```typescript
export async function attendanceReport(filters: { userId, entityId, dateFrom, dateTo, workerIds?, siteIds? }): Promise<AttendanceRow[]>
  // Per worker per day:
  // - Scheduled start (from ts_shifts), actual clock-in, actual clock-out
  // - Late flag (clock_in > shift start), early departure flag (clock_out < shift end)
  // - Hours worked, breaks taken, overtime
  // - Trust score

export async function hoursReport(filters): Promise<HoursRow[]>
  // Per worker: total hours, regular hours, overtime hours, by period (daily/weekly/monthly)

export async function overtimeReport(filters): Promise<OvertimeRow[]>
  // Per worker: overtime hours by rule type, cost = hours × rate × multiplier

export async function labourCostReport(filters): Promise<LabourCostRow[]>
  // Per worker: hours × hourly_rate, overtime × rate × multiplier
  // Per site: SUM of worker costs
  // Per project_tag: SUM of worker costs

export async function wageLeakageReport(filters): Promise<WageLeakageRow>
  // Aggregate:
  // - Hours outside geofence (SUM of entries where is_within_geofence_out = false)
  // - Late arrivals (COUNT + SUM minutes where clock_in > shift start)
  // - Early departures (COUNT + SUM minutes where clock_out < shift end)
  // - Missed shifts (COUNT of shifts with status 'scheduled' and date < today)
  // - Auto deductions applied (SUM deduction_minutes)
  // - Low trust entries (COUNT where trust_score < 50)
  // - Overtime cost
  // Headline: estimated_savings = (deduction_minutes / 60) × avg_hourly_rate + (outside_geofence_hours × avg_hourly_rate)

export async function payrollSummary(userId: string, entityId: string, periodStart: string, periodEnd: string): Promise<PayrollRow[]>
  // Per worker:
  // SELECT
  //   tw.employee_number, u.full_name, tw.hourly_rate, tw.currency,
  //   SUM(te.total_worked_minutes) as regular_minutes,
  //   SUM(te.overtime_minutes) as overtime_minutes,
  //   SUM(te.deduction_minutes) as deduction_minutes,
  //   SUM(te.total_break_minutes) as break_minutes,
  //   AVG(te.trust_score) as trust_score_avg
  // FROM ts_entries te
  // JOIN ts_workers tw ON te.worker_user_id = tw.worker_user_id AND te.entity_id = tw.entity_id
  // JOIN users u ON te.worker_user_id = u.id
  // WHERE te.user_id = $1 AND te.entity_id = $2
  // AND te.status IN ('approved', 'locked')
  // AND te.clock_in_at >= $3 AND te.clock_in_at < $4
  // GROUP BY tw.id, u.full_name
  //
  // Then for each worker, load overtime rules applied:
  // Calculate regular_pay = (regular_minutes - overtime_minutes) / 60 × hourly_rate
  // Calculate overtime_pay = sum of (overtime_minutes_per_rule / 60 × hourly_rate × multiplier)
  // total_pay = regular_pay + overtime_pay

export async function exportCsv(reportType: string, filters: any): Promise<string>
  // Call the appropriate report function
  // Convert rows to CSV string with headers
  // Return CSV string

export async function exportPdf(reportType: string, filters: any): Promise<Buffer>
  // Generate simple PDF from report data
  // Use basic HTML → PDF approach or plain text formatting
```

### 8b. API routes

| File | Methods | Purpose |
|------|---------|---------|
| `app/api/dashboard/live/route.ts` | GET | Who's clocked in now |
| `app/api/dashboard/summary/route.ts` | GET | Today's stats |
| `app/api/reports/attendance/route.ts` | GET | Query params: dateFrom, dateTo, workerIds, siteIds |
| `app/api/reports/hours/route.ts` | GET | Same filters |
| `app/api/reports/overtime/route.ts` | GET | Same filters |
| `app/api/reports/labour-cost/route.ts` | GET | Same filters |
| `app/api/reports/gps/route.ts` | GET | Wage leakage report |
| `app/api/reports/payroll-summary/route.ts` | GET | Query: periodStart, periodEnd |
| `app/api/reports/export/route.ts` | GET | Query: type (attendance/hours/overtime/labour-cost/gps/payroll), format (csv/pdf), + filters |

All report routes require `reports.view` permission. Export requires `reports.export`.

### 8c. UI pages

**`app/dashboard/page.tsx`:**
- **Stats cards row** (using StatsCard from @relentify/ui):
  - Total clocked in (with icon Users)
  - On break (with icon Coffee)
  - Total hours today (with icon Clock)
  - Pending approvals (with icon ClipboardCheck, links to /approvals)
  - Overtime alerts (with icon AlertTriangle, amber if any)
  - Unverified locations (with icon MapPinOff, red if any)
- **List view (default):**
  - Table/card list of currently clocked-in workers
  - Columns: Name, Site, Clocked In At, Duration, On Break, Geofence Status, Trust Score
  - Sort by duration DESC (longest shift first)
  - Row click → navigate to worker's entry detail
- **Map toggle** (Switch component):
  - When toggled: show Leaflet map with OpenStreetMap tiles
  - Worker pins at their last GPS ping location
  - Pin colour: green (in geofence), amber (unknown), red (out of geofence)
  - Click pin → popup with worker name, site, duration
  - Lazy-load Leaflet (dynamic import) to avoid bundle size impact
- **"Who's not here" section:**
  - List of workers with scheduled shifts today who haven't clocked in
  - Shows: name, scheduled time, "X mins late" badge

**`app/reports/page.tsx`:**
- Tabbed interface (TabsNav from @relentify/ui):
  - Attendance | Hours | Overtime | Labour Cost | Wage & Attendance | Payroll
- Shared filter bar: date range picker, worker multi-select, site multi-select
- Each tab renders a Table component with the report data
- Export button: dropdown with CSV / PDF options
- Charts (using simple bar/line components):
  - Hours tab: bar chart of hours per worker
  - Overtime tab: trend line of weekly overtime
  - Labour Cost tab: pie chart of cost by site
  - Wage & Attendance tab: headline "Estimated savings: £X" prominently displayed

### 8d. Verify Phase 8

1. With 2+ workers clocked in, dashboard shows correct list and counts
2. Toggle map → pins appear at worker locations
3. "Who's not here" shows workers with scheduled shifts but no clock-in
4. Payroll summary for a week → correct regular hours, overtime, rates, total pay
5. Wage leakage report → shows late arrivals, early departures, deductions, savings estimate
6. CSV export → valid CSV file downloads with correct data
7. Date range filter → reports update

### 8e. Commit

`[28timesheets] Phase 8: live dashboard, reports, payroll summary, wage leakage, export`

---

## Phase 9: Push Notifications + Smart Alerts

**Goal:** Web Push notifications. Shift reminders. Configurable alert rules for proactive management.

### 9a. Services

**`src/lib/notification.service.ts`:**
```typescript
import webpush from 'web-push'

// Initialise VAPID keys from env
webpush.setVapidDetails(
  'mailto:support@relentify.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPush(workerUserId: string, payload: { title: string; body: string; url?: string }): Promise<void>
  // 1. Get all subscriptions for this worker:
  //    SELECT * FROM ts_push_subscriptions WHERE worker_user_id = $1
  // 2. For each subscription:
  //    try {
  //      await webpush.sendNotification(
  //        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  //        JSON.stringify(payload)
  //      )
  //      UPDATE ts_push_subscriptions SET last_used_at = NOW() WHERE id = sub.id
  //    } catch (err) {
  //      if (err.statusCode === 410) DELETE FROM ts_push_subscriptions WHERE id = sub.id // expired
  //    }

export async function sendToManagers(entityId: string, payload: { title, body, url }): Promise<void>
  // Get all managers/admins/owners for this entity
  // Send push to each

export async function subscribeDevice(data: { userId, workerUserId, endpoint, p256dh, auth, deviceLabel }): Promise<void>
  // INSERT INTO ts_push_subscriptions (...) ON CONFLICT (endpoint) DO UPDATE

export async function unsubscribeDevice(endpoint: string): Promise<void>
  // DELETE FROM ts_push_subscriptions WHERE endpoint = $1
```

**`src/lib/alert-rules.service.ts`:**
```typescript
export async function evaluateAlerts(entityId: string): Promise<void>
  // 1. Load all active alert rules for this entity
  // 2. For each rule:
  //    - 'off_site_duration': SELECT workers who have been outside geofence for > threshold minutes
  //      (JOIN ts_entries with ts_gps_pings, check last ping timing)
  //    - 'late_arrivals_week': SELECT workers with > threshold late arrivals this week
  //      (JOIN ts_entries with ts_shifts where clock_in > shift start)
  //    - 'overtime_budget': SELECT total overtime this week, check against threshold %
  //    - 'pending_approvals_age': SELECT pending entries older than threshold days
  // 3. For each triggered alert: sendToManagers() with appropriate message

export async function createAlertRule(data: { userId, entityId, name, alertType, thresholdValue }): Promise<TsAlertRule>
export async function listAlertRules(userId: string, entityId: string): Promise<TsAlertRule[]>
export async function updateAlertRule(ruleId: string, userId: string, data: Partial<TsAlertRule>): Promise<TsAlertRule | null>
export async function deleteAlertRule(ruleId: string, userId: string): Promise<boolean>
```

### 9b. Cron route

**`app/api/cron/shift-reminders/route.ts`:**
```typescript
export async function POST(req: NextRequest) {
  // Verify cron secret
  // 1. Get upcoming shifts starting within next 15-60 mins (based on workspace settings):
  //    SELECT ts.*, u.full_name, s.name as site_name
  //    FROM ts_shifts ts
  //    JOIN users u ON ts.worker_user_id = u.id
  //    LEFT JOIN ts_sites s ON ts.site_id = s.id
  //    WHERE ts.status = 'scheduled'
  //    AND ts.start_time BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
  //    AND ts.start_time > NOW() + INTERVAL '14 minutes'  -- don't send if <15 mins (already sent)
  // 2. For each shift: sendPush(shift.worker_user_id, {
  //      title: 'Shift reminder',
  //      body: `Your shift at ${siteName} starts at ${startTime}`,
  //      url: '/worker/shifts'
  //    })
  // 3. Also run evaluateAlerts() for each entity
  // 4. Return { remindersSent, alertsTriggered }
}
```

### 9c. API routes

| File | Methods | Purpose |
|------|---------|---------|
| `app/api/push/subscribe/route.ts` | POST subscribe, DELETE unsubscribe | Public (any authenticated user) |
| `app/api/alert-rules/route.ts` | GET, POST | settings.manage |
| `app/api/alert-rules/[id]/route.ts` | PUT, DELETE | settings.manage |

### 9d. Service worker

**`public/sw.js`:**
```javascript
// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Relentify Timesheets', body: 'New notification' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/feed' }
    })
  )
})

// Click handler — open the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/feed'
  event.waitUntil(clients.openWindow(url))
})

// App shell caching (V1: basic)
const CACHE_NAME = 'timesheets-v1'
const SHELL_URLS = ['/', '/worker', '/feed']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  )
})

self.addEventListener('fetch', (event) => {
  // Network-first for API calls
  if (event.request.url.includes('/api/')) return

  // Cache-first for app shell
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})
```

Register in `app/layout.tsx`:
```typescript
// In a client component or useEffect:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### 9e. UI

**`app/settings/alerts/page.tsx`:**
- List of alert rules with toggle (active/inactive)
- "Add Alert" button → modal:
  - Name input
  - Type dropdown: "Worker off-site", "Late arrivals this week", "Overtime budget %", "Pending approvals age"
  - Threshold input (label changes by type: "minutes", "count", "%", "days")
- Delete button per rule

**Update worker UI** — add push notification registration prompt:
```typescript
// After first successful clock-in, check if push is supported:
if ('Notification' in window && Notification.permission === 'default') {
  // Show banner: "Allow notifications for shift reminders?"
  // On accept: Notification.requestPermission() → if granted:
  //   navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe({
  //     userVisibleOnly: true,
  //     applicationServerKey: VAPID_PUBLIC_KEY
  //   }))
  //   POST /api/push/subscribe with subscription object
}
```

### 9f. Generate VAPID keys

During deployment (Phase 11), generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```
Add to `.env`: `VAPID_PUBLIC_KEY=...`, `VAPID_PRIVATE_KEY=...`
Add public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for client-side use.

### 9g. Verify Phase 9

1. Register push subscription via browser
2. Schedule shift for 30 mins from now → receive push notification
3. Create alert rule "Worker off-site > 45 mins"
4. Simulate off-site worker → manager receives alert notification
5. Click notification → opens relevant page
6. Unsubscribe → no more notifications
7. Expired subscription → auto-cleaned on 410 response

### 9h. Commit

`[28timesheets] Phase 9: push notifications, shift reminders, smart alerts`

---

## Phase 10: PWA + Edge Cases + GDPR + Polish

**Goal:** Full PWA experience. GDPR consent. Data export. Responsive layout finalisation. Edge case handling completion.

### 10a. GDPR consent

**`src/lib/consent.service.ts`:**
```typescript
export async function hasConsented(workerUserId: string, entityId: string): Promise<boolean>
  // Check ts_audit_log for 'gdpr_consent_given' action by this worker
  // SELECT EXISTS(SELECT 1 FROM ts_audit_log WHERE actor_user_id = $1 AND entity_id = $2 AND action = 'gdpr_consent_given')

export async function recordConsent(workerUserId: string, entityId: string, ip: string): Promise<void>
  // logAudit({ userId: workerUserId, entityId, actorUserId: workerUserId,
  //   action: 'gdpr_consent_given', targetType: 'consent', details: { ip, timestamp: new Date() } })
```

**`app/consent/page.tsx`:**
- Full-screen consent page shown on first visit (middleware checks consent status)
- Heading: "Location & Data Collection"
- Body: "Your employer requires location verification for timesheets. Your GPS coordinates are recorded at clock-in, clock-out, breaks, and periodically during shifts. Your IP address and device information are also recorded. This data is visible to your manager and stored for [X] days (configurable by your employer)."
- "I understand and consent" button → POST records consent → redirect to `/worker`
- "Learn more" link → expandable section with GDPR rights (access, deletion, portability)

### 10b. Audit log + data export

**`app/api/audit/route.ts`:**
```typescript
export async function GET(req: NextRequest) {
  // auth → checkPermission (admin or viewer only)
  // Parse query: dateFrom, dateTo, actorUserId, action, page, limit
  // SELECT al.*, u.full_name as actor_name FROM ts_audit_log al JOIN users u ON al.actor_user_id = u.id
  // WHERE al.user_id = $1 AND al.entity_id = $2 [+ filters]
  // ORDER BY al.created_at DESC LIMIT $limit OFFSET $offset
  // Return { events, total }
}
```

**`app/api/workers/[id]/export/route.ts`:**
```typescript
export async function GET(req, { params }) {
  // auth → check: requesting user is the worker themselves OR has admin role
  // Gather all data for this worker:
  //   1. ts_entries (all)
  //   2. ts_breaks (via entry_id)
  //   3. ts_gps_pings (via entry_id)
  //   4. ts_shifts (assigned)
  //   5. ts_comments (authored)
  // Convert to CSV sections
  // Return as file download: Content-Disposition: attachment; filename="data-export-{date}.csv"
}
```

**`app/audit/page.tsx`:**
- Filterable table: date range, actor dropdown, action type filter
- Columns: timestamp, actor name, action, target, details (expandable JSON)
- Pagination

### 10c. PWA enhancement

**Update `public/sw.js`:**
- Enhanced app shell caching: cache all static assets on install
- Network-first for API with fallback to cached response for read endpoints
- Offline detection: if network fails on clock action, show "No connection — waiting to reconnect" with auto-retry

**Update `app/worker/page.tsx`:**
- "Add to Home Screen" banner: shown after first successful clock-in if `beforeinstallprompt` available
- iOS: detect Safari + show manual instruction card
- Offline indicator: banner at top when `navigator.onLine === false`
- `beforeunload` warning when worker is clocked in and tries to close tab

### 10d. Responsive layout finalisation

**`app/(app)/layout.tsx`:** (shared layout for all authenticated pages)
```typescript
'use client'
// Uses useIsMobile() from @relentify/ui
// Desktop (>1024px):
//   CollapsibleSidebar with groups based on role:
//     All roles: Clock In, Feed
//     Staff: My Shifts, My Timesheets
//     Manager+: Schedule, Approvals, Team
//     Admin+: Dashboard, Reports, Sites, Workers, Overtime Rules, Break Rules, Settings, Audit
//     Viewer: Dashboard, Reports, Audit
//
// Mobile (<1024px):
//   BottomTabBar with role-appropriate tabs:
//     Staff: Clock In, Feed, My Shifts, My Timesheets
//     Manager: Clock In, Feed, Schedule, Approvals, More (opens Sheet with remaining items)
//     Admin: Clock In, Feed, Schedule, Dashboard, More
//     Viewer: Feed, Dashboard, Reports
//
// "More" tab opens Sheet with full menu for items that don't fit in 5 tabs
```

### 10e. Edge case handling verification

Ensure all edge cases are handled (update existing services if not already):
- [ ] No GPS permission → clock.service.ts allows with null coords, trust_score = 0
- [ ] Signal loss mid-shift → no penalty, gps_verification_pct reflects actual vs expected pings
- [ ] Browser closed while clocked in → auto-clock-out cron handles it
- [ ] Worker selects wrong site → geofence check applies, warning shown, manager notified
- [ ] Overlapping shifts → clock.service.ts rejects "Already clocked in"
- [ ] Tab duplication → idempotency_key prevents double clock-in
- [ ] Clock-in with no site → allowed if project_tag_required = false, site_id = null

### 10f. Verify Phase 10

1. First visit as new worker → consent screen appears
2. Accept consent → redirected to clock-in, consent recorded in audit
3. Worker exports own data → CSV downloads with all entries, breaks, pings
4. Audit log shows all actions with correct actors
5. PWA: install on Android → launches fullscreen
6. Offline: disable network → shows offline banner → re-enable → recovers
7. Responsive: test all screens at 375px (phone), 768px (tablet), 1440px (desktop)
8. Role-based nav: staff sees 4 tabs, manager sees 5 tabs with "More"

### 10g. Commit

`[28timesheets] Phase 10: PWA, GDPR consent, data export, audit log, responsive layout`

---

## Phase 11: Docker + Deployment + Caddy

**Goal:** Deploy to production VPS. DNS, Caddy, cron, CLAUDE.md updates.

### 11a. Build Docker image

```bash
cd /opt/relentify-monorepo
docker compose -f apps/28timesheets/docker-compose.yml build --no-cache
```

If build fails: check Dockerfile, fix, rebuild. Common issues:
- Turbo prune name mismatch (must match package.json "name" field)
- Missing dependencies
- TypeScript errors (should be suppressed via `ignoreBuildErrors`)

### 11b. Create .env file

```bash
cp apps/28timesheets/.env.example apps/28timesheets/.env
# Fill in real values:
# DATABASE_URL from existing apps' .env files
# JWT_SECRET from existing apps' .env files
# Generate CRON_SECRET: openssl rand -hex 32
# Generate VAPID keys: npx web-push generate-vapid-keys
```

### 11c. Run migrations

```bash
# Option 1: from host
docker exec -it infra-postgres psql -U relentify_user -d relentify -f /dev/stdin < apps/28timesheets/database/migrations/001_core_tables.sql
docker exec -it infra-postgres psql -U relentify_user -d relentify -f /dev/stdin < apps/28timesheets/database/migrations/002_feed_triggers.sql

# Option 2: via migration runner after container starts
docker exec -it 28timesheets npx tsx database/run-migrations.ts
```

### 11d. DNS

Add A record in Cloudflare:
- Type: A
- Name: timesheets
- Content: [VPS IP]
- Proxy: enabled (orange cloud)
- SSL mode: Full (strict)

### 11e. Caddy config

Add to `/opt/infra/caddy/Caddyfile`:
```
timesheets.relentify.com {
    reverse_proxy 28timesheets:3028 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Reload: `docker exec infra-caddy caddy reload --config /etc/caddy/Caddyfile`

### 11f. Start container

```bash
cd /opt/relentify-monorepo/apps/28timesheets
docker compose up -d
docker logs 28timesheets --tail 50
```

Check health: `curl http://localhost:3028/api/health`

### 11g. Cron jobs

Add to VPS crontab (`crontab -e`):
```cron
# 28timesheets
*/5 * * * *   curl -s -H "x-cron-secret: CRON_SECRET_VALUE" http://localhost:3028/api/cron/auto-clock-out > /dev/null 2>&1
0   0 * * *   curl -s -H "x-cron-secret: CRON_SECRET_VALUE" http://localhost:3028/api/cron/overtime-calculation > /dev/null 2>&1
*/15 * * * *  curl -s -H "x-cron-secret: CRON_SECRET_VALUE" http://localhost:3028/api/cron/shift-reminders > /dev/null 2>&1
0   2 * * *   curl -s -H "x-cron-secret: CRON_SECRET_VALUE" http://localhost:3028/api/cron/data-retention > /dev/null 2>&1
```

### 11h. Update CLAUDE.md files

**`/root/.claude/CLAUDE.md`:**
- Add `timesheets.relentify.com | 28timesheets | 3028` to Domain → Container Map
- Add 28timesheets to Known Issues (healthy)
- Add `ts_` prefix tables to Database table ownership

**`apps/28timesheets/CLAUDE.md`:**
- Create app-specific CLAUDE.md documenting: architecture, key files, env vars, migrations, cron jobs, API route summary, known issues

### 11i. Cleanup

```bash
docker builder prune -f
```

### 11j. Verify Phase 11

1. `docker ps` → 28timesheets healthy
2. `curl https://timesheets.relentify.com/api/health` → `{ "status": "ok" }`
3. All 4 cron endpoints respond to curl with cron secret
4. `docker logs 28timesheets --tail 20` → no errors
5. Open `timesheets.relentify.com` in browser → app loads

### 11k. Commit

`[28timesheets] Phase 11: Docker deployment, Caddy, DNS, cron jobs`

---

## Phase 12: MCP Test Suite

**Goal:** Comprehensive integration tests covering all API routes.

### 12a. Setup

Create `/opt/infra/mcp/28timesheets-mcp/`:

```bash
mkdir -p /opt/infra/mcp/28timesheets-mcp/tools
cd /opt/infra/mcp/28timesheets-mcp
python3 -m venv venv
source venv/bin/activate
pip install httpx psycopg2-binary
```

### 12b. Shared files

**`config.py`:**
```python
BASE_URL = "http://localhost:3028"
CRON_SECRET = "..."  # from .env
DB_CONFIG = {
    "host": "172.18.0.6",  # infra-postgres IP from /etc/hosts
    "port": 5432,
    "user": "relentify_user",
    "password": "...",
    "database": "relentify"
}
```

**`auth.py`:**
```python
# Create a test user, generate JWT token
# Pattern: same as 22accounting-mcp auth.py
def get_auth_token() -> str:
    # Create user in DB if not exists
    # Generate JWT with userId, email, userType
    # Return token string
```

**`db.py`:**
```python
import psycopg2
from config import DB_CONFIG
def get_connection(): return psycopg2.connect(**DB_CONFIG)
def query(sql, params=None): ...
```

**`http_client.py`:**
```python
import httpx
from config import BASE_URL
from auth import get_auth_token

def get(path, **kwargs): return httpx.get(f"{BASE_URL}{path}", cookies={"relentify_token": get_auth_token()}, **kwargs)
def post(path, json=None, **kwargs): return httpx.post(f"{BASE_URL}{path}", json=json, cookies={"relentify_token": get_auth_token()}, **kwargs)
def put(path, json=None, **kwargs): return httpx.put(f"{BASE_URL}{path}", json=json, cookies={"relentify_token": get_auth_token()}, **kwargs)
def delete(path, **kwargs): return httpx.delete(f"{BASE_URL}{path}", cookies={"relentify_token": get_auth_token()}, **kwargs)
```

### 12c. Test modules

Each module follows the pattern: function per test, returns True/False, prints result.

**`tools/setup.py`:**
- `setup_test_env()`: create test user, entity, workspace settings, default site (with geofence), default worker
- Sets module-level variables for IDs used by other tests

**`tools/clock.py`:**
- `test_clock_in()`: POST /api/clock/in with GPS → 201, returns entry
- `test_clock_status()`: GET /api/clock/status → returns active entry
- `test_start_break()`: POST /api/clock/break/start → 201
- `test_end_break()`: POST /api/clock/break/end → 200
- `test_clock_out()`: POST /api/clock/out → 200, entry has total_worked_minutes
- `test_idempotency()`: POST /api/clock/in twice with same key → same entry
- `test_already_clocked_in()`: POST /api/clock/in while active → 400

**`tools/sites.py`:**
- `test_create_site()`: POST /api/sites → 201
- `test_list_sites()`: GET /api/sites → includes created site
- `test_update_site()`: PUT /api/sites/:id → 200
- `test_delete_site()`: DELETE /api/sites/:id → 200

**`tools/workers.py`:**
- `test_create_worker()`: POST /api/workers → 201
- `test_list_workers()`: GET /api/workers → includes worker
- `test_update_worker()`: PUT /api/workers/:id → 200 (change hourly rate)
- `test_import_csv()`: POST /api/workers/import with CSV → creates workers

**`tools/shifts.py`:**
- `test_create_shift()`: POST /api/shifts → 201
- `test_list_shifts()`: GET /api/shifts → includes shift
- `test_my_shifts()`: GET /api/shifts/my → worker sees own
- `test_cancel_shift()`: DELETE /api/shifts/:id → status cancelled
- `test_bulk_create()`: POST /api/shifts/bulk-create → multiple created

**`tools/shift_templates.py`:**
- `test_create_template()`: POST → 201
- `test_list_templates()`: GET → includes template
- `test_update_template()`: PUT → 200
- `test_delete_template()`: DELETE → 200

**`tools/entries.py`:**
- `test_list_entries()`: GET /api/entries → includes clock entries from earlier tests
- `test_get_entry()`: GET /api/entries/:id → full detail with breaks
- `test_edit_entry()`: PUT /api/entries/:id → update notes

**`tools/approval.py`:**
- `test_approve_entry()`: POST /api/entries/:id/approve → status approved
- `test_reject_entry()`: create new entry, POST /api/entries/:id/reject → status rejected with reason
- `test_bulk_approve()`: create 2 entries, POST /api/entries/bulk-approve → both approved
- `test_lock_entry()`: POST /api/entries/:id/lock → status locked
- `test_edit_locked()`: PUT /api/entries/:id on locked → 403

**`tools/overtime.py`:**
- `test_create_rule()`: POST /api/overtime-rules → 201
- `test_list_rules()`: GET → includes rule
- `test_update_rule()`: PUT → 200
- `test_delete_rule()`: DELETE → 200

**`tools/breaks.py`:**
- `test_create_rule()`: POST /api/break-rules → 201
- `test_list_rules()`: GET → includes rule
- `test_update_rule()`: PUT → 200
- `test_delete_rule()`: DELETE → 200

**`tools/settings.py`:**
- `test_get_settings()`: GET /api/settings → 200
- `test_update_settings()`: PUT /api/settings → verify persist

**`tools/feed.py`:**
- `test_get_feed()`: GET /api/feed → has events from clock tests
- `test_feed_has_clock_events()`: verify clock_in and clock_out events exist
- `test_feed_pagination()`: GET /api/feed?page=1&limit=5 → respects limits

**`tools/comments.py`:**
- `test_create_comment()`: POST /api/comments → 201
- `test_list_comments()`: GET /api/comments?entryId=X&feedEventType=clock_in → includes comment

**`tools/reports.py`:**
- `test_attendance()`: GET /api/reports/attendance → 200 with data
- `test_hours()`: GET /api/reports/hours → 200
- `test_overtime()`: GET /api/reports/overtime → 200
- `test_labour_cost()`: GET /api/reports/labour-cost → 200
- `test_gps()`: GET /api/reports/gps → 200 (wage leakage)
- `test_payroll_summary()`: GET /api/reports/payroll-summary → structured JSON with regular/overtime/pay
- `test_export_csv()`: GET /api/reports/export?type=hours&format=csv → valid CSV

**`tools/dashboard.py`:**
- `test_live_status()`: GET /api/dashboard/live → 200
- `test_summary()`: GET /api/dashboard/summary → 200 with stats

**`tools/team.py`:**
- `test_list_team()`: GET /api/team → 200
- `test_invite()`: POST /api/team/invite → 201
- `test_update_role()`: PUT /api/team/:id/role → 200

**`tools/alert_rules.py`:**
- `test_create_rule()`: POST /api/alert-rules → 201
- `test_list_rules()`: GET → includes rule
- `test_update_rule()`: PUT → 200
- `test_delete_rule()`: DELETE → 200

**`tools/cron.py`:**
- `test_auto_clock_out()`: POST /api/cron/auto-clock-out with cron secret → 200
- `test_overtime_calculation()`: POST → 200
- `test_shift_reminders()`: POST → 200
- `test_data_retention()`: POST → 200

**`tools/gps.py`:**
- `test_record_ping()`: clock in, POST /api/gps/ping → 200

**`tools/photos.py`:**
- `test_upload_photo()`: POST /api/photos/upload with test image → 200, returns hash

**`tools/audit.py`:**
- `test_get_audit_log()`: GET /api/audit → 200 with events

**`tools/ui_checks.py`:**
- Test each page route returns 200 (not 404/500):
  `/worker`, `/feed`, `/schedule`, `/approvals`, `/dashboard`,
  `/reports`, `/sites`, `/workers`, `/settings`, `/team`,
  `/overtime-rules`, `/break-rules`, `/audit`

**`tools/teardown.py`:**
- Delete test data: ts_entries, ts_breaks, ts_gps_pings, ts_shifts, ts_workers, ts_sites, ts_comments, ts_feed_events, ts_photos, ts_photo_data for test user
- Delete test user from users + workspace_members + entities

### 12d. Test runner

**`run_tests.py`:**
```python
# Import all test modules
# Run in order: setup → clock → sites → workers → shifts → shift_templates →
#   entries → approval → overtime → breaks → settings → feed → comments →
#   dashboard → reports → team → alert_rules → cron → gps → photos →
#   audit → ui_checks → teardown
# Track pass/fail counts
# Print summary: "RESULTS: X/Y passed"
```

### 12e. Verify Phase 12

```bash
cd /opt/infra/mcp/28timesheets-mcp
source venv/bin/activate
python3 run_tests.py
```

Target: 80+ tests, all passing.

### 12f. Update CLAUDE.md

Add to `## MCP Servers` table:
```
| 28timesheets | `/opt/infra/mcp/28timesheets-mcp/` | `"28timesheets"` | XX/XX ✅ |
```

### 12g. Commit

`[28timesheets] Phase 12: MCP test suite, XX/XX tests passing`

---

## Phase Dependencies

```
Phase 0 (spec update)
└── Phase 1 (scaffold + clock)
    ├── Phase 2 (sites + workers + settings + team)
    │   ├── Phase 3 (shifts + scheduling)
    │   │   └── Phase 5 (overtime + breaks + auto clock-out + trust score)
    │   │       └── Phase 6 (GPS pings + photos)
    │   └── Phase 4 (approval workflow)
    ├── Phase 7 (feed + comments) — needs triggers from Phase 1
    ├── Phase 8 (dashboard + reports) — needs data from Phases 2-6
    ├── Phase 9 (push notifications + alerts) — needs feed events
    ├── Phase 10 (PWA + GDPR + polish) — needs all above
    ├── Phase 11 (deployment) — needs all above
    └── Phase 12 (MCP tests) — needs deployment
```

---

## Critical Files to Reference

| File | Why |
|------|-----|
| `apps/22accounting/src/lib/db.ts` | Exact db.ts to copy |
| `apps/22accounting/src/lib/auth.ts` | Auth pattern with workspace permissions |
| `apps/22accounting/src/lib/workspace-auth.ts` | checkPermission() pattern |
| `apps/22accounting/middleware.ts` | Rate limiting + auth middleware |
| `apps/22accounting/app/api/suppliers/route.ts` | API route pattern (auth → permission → entity → validate → service → response) |
| `apps/22accounting/src/lib/supplier.service.ts` | Service function pattern |
| `apps/22accounting/src/lib/team.service.ts` | Team invite/accept pattern |
| `apps/22accounting/Dockerfile` | Docker build pattern |
| `apps/22accounting/docker-compose.yml` | Compose pattern |
| `apps/22accounting/next.config.js` | Standalone + transpile config |
| `apps/22accounting/app/layout.tsx` | Root layout with ThemeProvider |
| `packages/ui/src/animations.ts` | Spring presets (snappy, smooth, gentle, bounce) |
| `packages/ui/src/components/layout/CollapsibleSidebar.tsx` | Desktop nav reference |
| `packages/auth/src/index.ts` | Shared auth (verifyAuthToken, AUTH_COOKIE_NAME) |
| `packages/ui/src/hooks/useTheme.ts` | Theme + THEME_SCRIPT |
