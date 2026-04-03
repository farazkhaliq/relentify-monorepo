# PLATFORM CONTEXT (INHERITED FROM MONOREPO)

This app is part of the Relentify monorepo.

You MUST follow all platform-level rules defined in the monorepo claude.md, especially:

- All UI must come from @relentify/ui (no local UI components)
- No hardcoded colours or styling outside theme tokens
- Shared auth, database, and architecture must be respected
- Apps must feel like a single unified product

If there is any conflict between this file and the monorepo claude.md:
→ The monorepo claude.md takes precedence

---

# 28timesheets

GPS-verified mobile timesheet app for field staff. Built for construction, cleaning, facilities management — any business with workers on-site.

Container: `28timesheets` on port 3028 → timesheets.relentify.com
Shared DB: `infra-postgres` → relentify DB, relentify_user
Monorepo: `/opt/relentify-monorepo/apps/28timesheets/`

---

## Architecture

- **Next.js 15 App Router** — pages under `app/`, APIs under `app/api/`
- **Raw SQL** via `pg` — no Prisma ORM, uses `src/lib/db.ts` (Pool, query, withTransaction)
- **Services pattern** — all DB logic in `src/lib/*.service.ts`, never raw queries in routes
- **Auth** — `getAuthUser()` from `src/lib/auth.ts`, checks `relentify_token` cookie via JWT
- **Permissions** — `TimesheetPermissions` interface with 6 modules: timesheets, scheduling, reports, settings, team, sites
- **Feed** — trigger-based materialised feed via PostgreSQL AFTER INSERT/UPDATE triggers on `ts_entries`, `ts_breaks`, `ts_shifts`
- **GPS** — Haversine distance calculation, geofence checking via `geo.service.ts`
- **Trust score** — computed at clock-out (0-100), not via trigger

---

## Database Tables (ts_* prefix, 20 tables)

| Table | Purpose |
|-------|---------|
| `ts_entries` | Core timesheet records — one per shift worked |
| `ts_breaks` | Break records, multiple per entry |
| `ts_gps_pings` | Periodic GPS checks during shifts |
| `ts_sites` | Job locations with geofencing |
| `ts_workers` | Per-worker config (hourly rate, overrides) |
| `ts_shifts` | Scheduled shifts |
| `ts_shift_templates` | Reusable shift patterns |
| `ts_settings` | Workspace-wide config |
| `ts_overtime_rules` | Overtime rule definitions |
| `ts_break_rules` | Break rule definitions |
| `ts_feed_events` | Trigger-populated activity feed |
| `ts_comments` | Comment threads on feed events |
| `ts_photos` | Photo metadata |
| `ts_photo_data` | Photo binary data |
| `ts_push_subscriptions` | Web Push subscriptions |
| `ts_audit_log` | Audit trail |
| `ts_alert_rules` | Smart alert configuration |
| `ts_time_off_types` | V2 — created empty |
| `ts_time_off_requests` | V2 — created empty |
| `ts_migration_history` | Migration tracking |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Postgres pool, query wrapper, withTransaction |
| `src/lib/auth.ts` | JWT auth, TimesheetPermissions, getAuthUser() |
| `src/lib/workspace-auth.ts` | checkPermission() — module/action based |
| `src/lib/entity.service.ts` | getActiveEntity() |
| `src/lib/clock.service.ts` | clockIn, clockOut, startBreak, endBreak |
| `src/lib/entry.service.ts` | getActiveEntry, getEntryById, listEntries |
| `src/lib/site.service.ts` | Site CRUD |
| `src/lib/worker.service.ts` | Worker CRUD |
| `src/lib/settings.service.ts` | Workspace settings CRUD |
| `src/lib/geo.service.ts` | Haversine distance, geofence check |
| `src/lib/audit.service.ts` | Fire-and-forget audit logging |

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/clock/in` | Clock in with GPS |
| POST | `/api/clock/out` | Clock out with GPS |
| GET | `/api/clock/status` | Current clock status + active break |
| POST | `/api/clock/break/start` | Start a break |
| POST | `/api/clock/break/end` | End a break |

---

## Env Vars

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret (shared across monorepo) |
| `CRON_SECRET` | Cron job authentication |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key |
| `NEXT_PUBLIC_APP_URL` | Public URL for the app |

---

## Migrations

Located at `database/migrations/`. Run via:
```bash
cat apps/28timesheets/database/migrations/NNN_*.sql | docker exec -i infra-postgres psql -U relentify_user -d relentify
```

| File | Content |
|------|---------|
| `001_core_tables.sql` | All 20 ts_* tables + indexes |
| `002_feed_triggers.sql` | PostgreSQL triggers for feed events |

---

## Build Status

### Phase 1: Scaffolding + Database + Clock In/Out — ✅ Complete
- BottomTabBar added to `@relentify/ui`
- All 20 ts_* tables created
- Feed triggers installed
- Clock in/out/break API routes working
- Worker UI with timer, GPS, clock in/out/break
- Docker container healthy on port 3028
- Caddy reverse proxy configured

### Phase 2: Sites + Workers + Settings + Team — Pending
### Phase 3: Shifts + Scheduling — Pending
### Phase 4: Approval Workflow — Pending
### Phase 5: Overtime + Break Rules + Auto Clock-Out + Trust Score — Pending
### Phase 6: GPS Pings + Photo Verification — Pending
### Phase 7: Activity Feed + Comments — Pending
### Phase 8: Dashboard + Reports — Pending
### Phase 9: Push Notifications + Smart Alerts — Pending
### Phase 10: PWA + GDPR + Polish — Pending
### Phase 11: Docker Deployment — ✅ Complete (Phase 1 deployment)
### Phase 12: MCP Test Suite — Pending
