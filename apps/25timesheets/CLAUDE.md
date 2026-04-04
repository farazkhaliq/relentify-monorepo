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
DB: `infra-postgres` → `relentify` database, `relentify_user` — all tables prefixed `ts_` (same pattern as `acc_`, `crm_`, `inv_`)
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
| `src/lib/shift.service.ts` | Shift CRUD, bulk create, conflict detection |
| `src/lib/shift-template.service.ts` | Shift template CRUD |
| `src/lib/team.service.ts` | Team invite, accept, list, role/permissions |
| `src/lib/import.service.ts` | CSV worker import |
| `src/lib/approval.service.ts` | Approve, reject, bulk, lock entries |
| `src/lib/overtime.service.ts` | Overtime rules CRUD + calculation |
| `src/lib/break-rules.service.ts` | Break rules CRUD + compliance evaluation |
| `src/lib/trust-score.service.ts` | Trust score computation (0-100) |
| `src/lib/auto-clock-out.service.ts` | Cron-driven auto clock-out with deductions |
| `src/lib/gps.service.ts` | GPS ping recording + geofence tracking |
| `src/lib/feed.service.ts` | Activity feed queries (role-scoped) |
| `src/lib/comment.service.ts` | Comment threads on feed events |
| `src/lib/dashboard.service.ts` | Live status + daily summary |
| `src/lib/reports.service.ts` | Payroll, attendance, hours, wage leakage, CSV export |
| `src/lib/notification.service.ts` | Web Push via VAPID, sendPush, sendToManagers |
| `src/lib/alert-rules.service.ts` | Smart alert evaluation (off-site, late, pending) |
| `src/lib/consent.service.ts` | GDPR consent check + record |
| `src/lib/photo.service.ts` | Photo storage with SHA-256 reuse detection |

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
| GET/POST | `/api/sites` | Site CRUD |
| GET/PUT/DEL | `/api/sites/:id` | Single site |
| GET/POST | `/api/workers` | Worker CRUD |
| GET/PUT | `/api/workers/:id` | Single worker |
| POST | `/api/workers/import` | CSV import |
| GET/PUT | `/api/settings` | Workspace settings |
| GET/POST | `/api/team` | Team members + invite |
| PUT | `/api/team/:id/role` | Update member role |
| PUT | `/api/team/:id/permissions` | Update member permissions |
| GET/POST | `/api/shifts` | Shift CRUD |
| GET/PUT/DEL | `/api/shifts/:id` | Single shift |
| POST | `/api/shifts/bulk-create` | Bulk shift creation |
| GET | `/api/shifts/my` | Worker's own shifts |
| GET/POST | `/api/shift-templates` | Shift template CRUD |
| PUT/DEL | `/api/shift-templates/:id` | Single template |
| GET | `/api/entries` | List entries |
| GET/PUT/DEL | `/api/entries/:id` | Single entry |
| POST | `/api/entries/:id/approve` | Approve entry |
| POST | `/api/entries/:id/reject` | Reject entry |
| POST | `/api/entries/:id/lock` | Lock entry |
| POST | `/api/entries/bulk-approve` | Bulk approve |
| POST | `/api/entries/bulk-reject` | Bulk reject |
| GET/POST | `/api/overtime-rules` | Overtime rules CRUD |
| PUT/DEL | `/api/overtime-rules/:id` | Single overtime rule |
| GET/POST | `/api/break-rules` | Break rules CRUD |
| PUT/DEL | `/api/break-rules/:id` | Single break rule |
| POST | `/api/gps/ping` | Record GPS ping |
| GET | `/api/feed` | Activity feed |
| GET/POST | `/api/comments` | Comment threads |
| GET | `/api/dashboard/live` | Live clocked-in status |
| GET | `/api/dashboard/summary` | Daily summary stats |
| GET | `/api/reports/payroll-summary` | Payroll report |
| GET | `/api/reports/attendance` | Attendance report |
| GET | `/api/reports/hours` | Hours report |
| GET | `/api/reports/gps` | Wage leakage report |
| GET | `/api/reports/export` | CSV export |
| GET | `/api/audit` | Audit log |
| GET/POST | `/api/alert-rules` | Smart alert rules |
| PUT/DEL | `/api/alert-rules/:id` | Single alert rule |
| POST | `/api/cron/auto-clock-out` | Auto clock-out cron |
| POST | `/api/cron/overtime-calculation` | Nightly overtime cron |
| POST | `/api/cron/shift-reminders` | Shift reminders cron |
| POST | `/api/cron/data-retention` | GDPR data retention cron |
| POST/DEL | `/api/push/subscribe` | Push notification subscribe/unsubscribe |
| GET/POST | `/api/consent` | GDPR consent check/record |
| POST | `/api/photos/upload` | Upload photo (clock-in/out) |
| GET | `/api/photos/:id` | Serve photo |
| GET | `/api/workers/:id/export` | GDPR data export (CSV) |

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
### Phase 2: Sites + Workers + Settings + Team + CSV Import — ✅ Complete
### Phase 3: Shifts + Scheduling + Templates — ✅ Complete
### Phase 4: Approval Workflow + Bulk Approve/Reject + Locking — ✅ Complete
### Phase 5: Overtime + Break Rules + Auto Clock-Out + Trust Score — ✅ Complete
### Phase 6: GPS Pings + Geofence Tracking — ✅ Complete
### Phase 7: Activity Feed + Comments — ✅ Complete
### Phase 8: Dashboard + Reports + CSV Export — ✅ Complete
### Phase 9: Push Notifications + Smart Alerts — ✅ Complete
### Phase 10: PWA + GDPR + Polish — ✅ Complete
### Phase 11: Docker Deployment + Cron Jobs — ✅ Complete
### Phase 12: MCP Test Suite — ✅ Complete (61/61 tests passing)
