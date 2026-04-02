# Relentify Timesheets — Design Spec

## Summary

A standalone web app (`28timesheets`) for GPS-verified mobile timesheet tracking aimed at field staff. Workers clock in/out from their phone browser with GPS, IP, and photo verification. Managers schedule shifts, approve timesheets, and monitor teams in real time. Admins configure overtime rules, break rules, geofencing, and deduction policies — all overridable per worker.

Built as a Progressive Web App on Next.js 15, sharing the `@relentify/ui` component library, `@relentify/auth` JWT auth, and `infra-postgres` database with the rest of the Relentify suite.

## Goals

- Mobile-first responsive web app (not native) that works on any phone browser
- PWA with "Add to Home Screen" for fullscreen native-like experience
- GPS-stamped clock-in/out with optional geofence enforcement
- IP + device logging for anti-fraud
- Optional photo verification (selfie on punch)
- Scheduled shifts (manager-assigned) and ad-hoc shifts (worker-initiated) coexist
- Configurable overtime and break rules with per-worker overrides
- Auto clock-out with GPS-based deduction logic
- Approval workflow with bulk approve, reject, lock
- Activity feed with inline comment threads replacing traditional notification bell
- Live dashboard showing who's clocked in, where, right now
- Reports with CSV/PDF export
- Push notifications via Web Push API
- 5 roles: owner, admin, manager, staff, viewer

## Non-goals (V1)

- Native mobile app (iOS/Android)
- Offline clock-in/out (V2 — PWA shell cached in V1, offline punches in V2)
- Kiosk mode with PIN entry (V2)
- PTO / time-off management (V2)
- Shift swapping / open shifts (V2)
- Digital signatures on timesheets (V2)
- Payroll export to 22accounting (V2)
- GPS breadcrumb tracking / route mapping (V3)
- Mileage tracking (use 22accounting's existing mileage feature)
- Job costing with profitability reports (V3)
- AI auto-scheduling (V3)
- Team messaging (V3)
- Compliance engine for Working Time Regulations (V3)
- Training / onboarding
- Forms / checklists
- Company newsfeed

## Competitive positioning

Priced at £1/person/month — undercutting Deputy (£4.50-6), QuickBooks Time (£8-10 + base fee), and Connecteam (~£2). Key differentiators:

1. **Integrated ecosystem** — Timesheets feeds into Payroll feeds into Accounting. No third-party integration friction.
2. **IP + device tracking** — neither Deputy nor Connecteam highlights this anti-fraud layer.
3. **Single login** across all Relentify products.
4. **Transparent pricing** — one price, all features. No add-ons, no tier-locked GPS/geofencing.

---

## Architecture

### Infrastructure

| | |
|---|---|
| App location | `/opt/relentify-monorepo/apps/28timesheets/` |
| Container | `28timesheets` |
| Port | 3028 |
| Domain | `timesheets.relentify.com` |
| Framework | Next.js 15 App Router |
| Database | Shared `infra-postgres`, tables prefixed `ts_` |
| Auth | `@relentify/auth` JWT, shared `.relentify.com` cookie |
| UI | 100% `@relentify/ui` — no local components |
| Styling | Tailwind + CSS theme variables (no hardcoded colours) |
| Animations | Framer Motion with `@relentify/ui` spring presets |

### Single responsive app

One app, responsive throughout. No separate "mobile" and "desktop" experiences. Every screen works on a phone.

- **Mobile (<640px):** Single column, bottom tab bar, full-width cards, big touch targets
- **Tablet (640-1024px):** Single column, bottom tabs, wider cards
- **Desktop (>1024px):** CollapsibleSidebar + content area

### Role model

Uses the same `workspace_members` pattern as 22accounting. Role sets permission defaults, individual permissions tweakable per member.

| Role | Can do | Example person |
|------|--------|---------------|
| `owner` | Everything + delete workspace + billing | Business owner |
| `admin` | Everything except billing/delete workspace | Operations director |
| `manager` | Schedule shifts, approve timesheets, manage sites, view reports, manage their assigned team | Site foreman, shift supervisor |
| `staff` | Clock in/out, view own timesheets, view own schedule | Field worker |
| `viewer` | Read-only access to all data. Cannot modify anything. Enables API key access. | Finance team, payroll system, accountant |

### Permissions JSONB

```typescript
interface TimesheetPermissions {
  timesheets: { view: boolean; create: boolean; approve: boolean };
  scheduling: { view: boolean; create: boolean; assign: boolean };
  reports:    { view: boolean; export: boolean };
  settings:   { view: boolean; manage: boolean };
  team:       { view: boolean; manage: boolean };
  sites:      { view: boolean; manage: boolean };
}
```

### Middleware routing

- Staff role → default landing `/worker` (clock-in focused)
- Manager/Admin → default landing `/feed`
- Viewer → default landing `/dashboard`
- All roles can navigate to any screen they have permissions for

---

## Data Model

All tables in the shared `relentify` database, prefixed `ts_`. Multi-tenant via `user_id` (workspace owner) + `entity_id`.

### ts_sites

Job locations with optional geofencing.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| entity_id | UUID FK → entities | |
| name | VARCHAR(255) | |
| address | TEXT | |
| latitude | DECIMAL | |
| longitude | DECIMAL | |
| geofence_radius_metres | INTEGER | Nullable — null means no geofence |
| require_photo_on_punch | BOOLEAN | Default false |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ts_workers

Timesheet-specific config per worker. Sits alongside `workspace_members` (which handles auth/role/permissions).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| entity_id | UUID FK → entities | |
| worker_user_id | UUID FK → users | The worker |
| manager_user_id | UUID FK → users | Nullable — assigned manager for scoping |
| employee_number | VARCHAR(50) | Nullable — employer's internal ref |
| hourly_rate | DECIMAL | Nullable |
| currency | VARCHAR(10) | Default 'GBP' |
| employment_type | VARCHAR(20) | 'full_time', 'part_time', 'contractor', 'casual' |
| contracted_weekly_minutes | INTEGER | Nullable — e.g. 2400 = 40h |
| default_site_id | UUID FK → ts_sites | Nullable |
| can_work_overtime | BOOLEAN | Default true |
| overtime_rate_override | DECIMAL | Nullable — overrides workspace default |
| allowed_site_ids | UUID[] | Nullable — null means all sites |
| require_photo_override | BOOLEAN | Nullable — null means use workspace/site default |
| gps_ping_override | INTEGER | Nullable — null means use workspace default |
| break_rule_overrides | JSONB | Nullable |
| overtime_rule_overrides | JSONB | Nullable |
| start_date | DATE | Nullable |
| end_date | DATE | Nullable — for fixed-term contracts |
| is_active | BOOLEAN | Default true |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ts_shift_templates

Reusable shift patterns.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| site_id | UUID FK → ts_sites | Nullable |
| name | VARCHAR(255) | |
| start_time | TIME | |
| end_time | TIME | |
| break_minutes | INTEGER | |
| is_paid_break | BOOLEAN | |
| recurrence | JSONB | e.g. `{days: [1,2,3,4,5], type: 'weekly'}` |
| created_at | TIMESTAMPTZ | |

### ts_shifts

Individual scheduled shifts assigned to workers.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| template_id | UUID FK → ts_shift_templates | Nullable |
| site_id | UUID FK → ts_sites | Nullable |
| worker_user_id | UUID FK → users | |
| date | DATE | |
| start_time | TIMESTAMPTZ | |
| end_time | TIMESTAMPTZ | |
| notes | TEXT | Nullable |
| status | VARCHAR(20) | 'scheduled', 'in_progress', 'completed', 'cancelled' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ts_entries

The core timesheet record — one per shift worked.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| entity_id | UUID FK → entities | |
| shift_id | UUID FK → ts_shifts | Nullable — null for ad-hoc |
| worker_user_id | UUID FK → users | |
| site_id | UUID FK → ts_sites | Nullable |
| project_tag | VARCHAR(255) | Nullable — free text tag |
| clock_in_at | TIMESTAMPTZ | |
| clock_out_at | TIMESTAMPTZ | Nullable — null while clocked in |
| clock_in_latitude | DECIMAL | |
| clock_in_longitude | DECIMAL | |
| clock_out_latitude | DECIMAL | Nullable |
| clock_out_longitude | DECIMAL | Nullable |
| clock_in_ip | VARCHAR(45) | |
| clock_out_ip | VARCHAR(45) | Nullable |
| clock_in_device | JSONB | User agent, screen size |
| clock_out_device | JSONB | Nullable |
| clock_in_photo_url | VARCHAR(500) | Nullable |
| clock_out_photo_url | VARCHAR(500) | Nullable |
| is_within_geofence_in | BOOLEAN | |
| is_within_geofence_out | BOOLEAN | Nullable |
| auto_clocked_out | BOOLEAN | Default false |
| deduction_minutes | INTEGER | Default 0 |
| deduction_reason | VARCHAR(255) | Nullable |
| total_break_minutes | INTEGER | Default 0 |
| total_worked_minutes | INTEGER | Computed: clock_out - clock_in - breaks - deductions |
| overtime_minutes | INTEGER | Default 0 |
| status | VARCHAR(20) | 'active', 'pending_approval', 'approved', 'rejected', 'locked' |
| approved_by | UUID FK → users | Nullable |
| approved_at | TIMESTAMPTZ | Nullable |
| rejection_reason | VARCHAR(255) | Nullable |
| notes | TEXT | Nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ts_breaks

Break records — multiple per entry.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| entry_id | UUID FK → ts_entries | |
| start_at | TIMESTAMPTZ | |
| end_at | TIMESTAMPTZ | Nullable — null while on break |
| break_type | VARCHAR(10) | 'paid', 'unpaid' |
| start_latitude | DECIMAL | |
| start_longitude | DECIMAL | |
| end_latitude | DECIMAL | Nullable |
| end_longitude | DECIMAL | Nullable |
| duration_minutes | INTEGER | Computed on end |
| created_at | TIMESTAMPTZ | |

### ts_gps_pings

Periodic location checks during active shifts.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| entry_id | UUID FK → ts_entries | |
| latitude | DECIMAL | |
| longitude | DECIMAL | |
| accuracy_metres | DECIMAL | |
| is_within_geofence | BOOLEAN | |
| captured_at | TIMESTAMPTZ | |
| source | VARCHAR(20) | 'high_accuracy', 'low_accuracy', 'checkpoint' |

### ts_overtime_rules

Configurable per workspace.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| name | VARCHAR(255) | |
| rule_type | VARCHAR(20) | 'daily', 'weekly', 'consecutive_day', 'holiday', 'night' |
| threshold_minutes | INTEGER | e.g. 480 for 8h daily |
| multiplier | DECIMAL | e.g. 1.5, 2.0 |
| conditions | JSONB | e.g. `{after_hour: 21}` for night, `{days: 6}` for consecutive |
| priority | INTEGER | Higher priority applied first |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |

### ts_break_rules

Configurable per workspace.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| name | VARCHAR(255) | |
| after_worked_minutes | INTEGER | e.g. 360 = 6 hours |
| break_duration_minutes | INTEGER | e.g. 30 |
| break_type | VARCHAR(10) | 'paid', 'unpaid' |
| auto_deduct | BOOLEAN | Auto-deduct if worker doesn't take break |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | |

### ts_settings

Workspace-wide configuration.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| require_gps | BOOLEAN | Default true |
| require_photo | BOOLEAN | Default false |
| gps_ping_interval_minutes | INTEGER | Default 30. Options: 15, 30, 60, or null (checkpoints only) |
| auto_clock_out_enabled | BOOLEAN | Default true |
| auto_clock_out_after_minutes | INTEGER | e.g. 720 = 12h max |
| auto_clock_out_at_shift_end | BOOLEAN | Default true |
| deduction_mode | VARCHAR(20) | 'auto', 'flag_for_review', 'none' |
| deduction_type | VARCHAR(10) | 'fixed', 'dynamic' |
| fixed_deduction_minutes | INTEGER | Nullable — for fixed mode |
| project_tag_required | BOOLEAN | Default false |
| allow_early_clock_in_minutes | INTEGER | Default 15 |
| allow_late_clock_out_minutes | INTEGER | Default 15 |
| gps_retention_days | INTEGER | Default 90 — GDPR |
| photo_retention_days | INTEGER | Default 90 — GDPR |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ts_comments

Comment threads on feed events.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| entity_id | UUID FK → entities | |
| entry_id | UUID FK → ts_entries | Nullable |
| shift_id | UUID FK → ts_shifts | Nullable |
| feed_event_type | VARCHAR(30) | 'clock_in', 'clock_out', 'auto_clock_out', 'break', 'geofence_violation', 'approval', 'rejection', 'deduction', 'overtime_alert' |
| feed_event_id | VARCHAR(100) | Composite key identifying the specific event |
| author_user_id | UUID FK → users | |
| body | TEXT | |
| created_at | TIMESTAMPTZ | |

### ts_push_subscriptions

Web Push API subscriptions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| worker_user_id | UUID FK → users | |
| endpoint | TEXT | |
| p256dh | TEXT | |
| auth | TEXT | |
| device_label | VARCHAR(255) | e.g. "Chrome on Samsung A54" |
| created_at | TIMESTAMPTZ | |
| last_used_at | TIMESTAMPTZ | |

### ts_audit_log

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | Workspace owner |
| entity_id | UUID FK → entities | |
| actor_user_id | UUID FK → users | |
| action | VARCHAR(50) | |
| target_type | VARCHAR(50) | |
| target_id | UUID | |
| details | JSONB | |
| created_at | TIMESTAMPTZ | |

### ts_time_off_types (V2 — created empty)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| name | VARCHAR(100) | |
| is_paid | BOOLEAN | |
| default_allowance_days | DECIMAL | |

### ts_time_off_requests (V2 — created empty)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| entity_id | UUID FK → entities | |
| worker_user_id | UUID FK → users | |
| type_id | UUID FK → ts_time_off_types | |
| start_date | DATE | |
| end_date | DATE | |
| status | VARCHAR(20) | |
| approved_by | UUID FK → users | Nullable |
| notes | TEXT | Nullable |

### Setting resolution order

For any configurable setting:
1. Check `ts_workers` override for this worker
2. If null → check `ts_sites` setting for the worker's current site
3. If null → check `ts_settings` workspace default

---

## API Routes

All routes behind `getAuthUser()` + `checkPermission()`.

### Clock actions (worker-facing)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/clock/in` | JWT | Clock in (GPS, IP, device, photo) |
| POST | `/api/clock/out` | JWT | Clock out |
| POST | `/api/clock/break/start` | JWT | Start break |
| POST | `/api/clock/break/end` | JWT | End break |
| GET | `/api/clock/status` | JWT | Current shift status |

### Entries (timesheets)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/entries` | JWT | List (filterable: worker, date range, status, site) |
| GET | `/api/entries/:id` | JWT | Single entry with breaks + GPS pings |
| PUT | `/api/entries/:id` | JWT | Edit (manager+, or worker if pending) |
| DELETE | `/api/entries/:id` | JWT | Delete (admin only, not if locked) |
| POST | `/api/entries/:id/approve` | JWT | Approve (manager+) |
| POST | `/api/entries/:id/reject` | JWT | Reject with reason (manager+) |
| POST | `/api/entries/bulk-approve` | JWT | Approve multiple (manager+) |
| POST | `/api/entries/bulk-reject` | JWT | Reject multiple with reason (manager+) |
| POST | `/api/entries/:id/lock` | JWT | Lock after approval |

### Shifts (scheduling)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/shifts` | JWT | List (filterable) |
| POST | `/api/shifts` | JWT | Create + assign (manager+) |
| PUT | `/api/shifts/:id` | JWT | Update (manager+) |
| DELETE | `/api/shifts/:id` | JWT | Cancel (manager+) |
| POST | `/api/shifts/bulk-create` | JWT | Create multiple shifts |
| GET | `/api/shifts/my` | JWT | Worker's own upcoming shifts |

### Shift templates

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/shift-templates` | JWT | List |
| POST | `/api/shift-templates` | JWT | Create (manager+) |
| PUT | `/api/shift-templates/:id` | JWT | Update |
| DELETE | `/api/shift-templates/:id` | JWT | Delete |

### Sites

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/sites` | JWT | List all sites |
| POST | `/api/sites` | JWT | Create (admin+) |
| PUT | `/api/sites/:id` | JWT | Update (admin+) |
| DELETE | `/api/sites/:id` | JWT | Deactivate (admin+) |

### Workers

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/workers` | JWT | List all workers with config |
| GET | `/api/workers/:id` | JWT | Single worker profile + stats |
| POST | `/api/workers` | JWT | Create ts_workers record |
| PUT | `/api/workers/:id` | JWT | Update config |

### Overtime rules

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/overtime-rules` | JWT | List |
| POST | `/api/overtime-rules` | JWT | Create (admin+) |
| PUT | `/api/overtime-rules/:id` | JWT | Update |
| DELETE | `/api/overtime-rules/:id` | JWT | Delete |

### Break rules

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/break-rules` | JWT | List |
| POST | `/api/break-rules` | JWT | Create (admin+) |
| PUT | `/api/break-rules/:id` | JWT | Update |
| DELETE | `/api/break-rules/:id` | JWT | Delete |

### Settings

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/settings` | JWT | Workspace settings |
| PUT | `/api/settings` | JWT | Update (admin+) |

### Reports

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/reports/attendance` | JWT | Who was in/out by date range |
| GET | `/api/reports/hours` | JWT | Hours worked per worker per period |
| GET | `/api/reports/overtime` | JWT | Overtime breakdown per worker |
| GET | `/api/reports/labour-cost` | JWT | Cost by worker/site/project |
| GET | `/api/reports/gps` | JWT | GPS verification summary |
| GET | `/api/reports/export` | JWT | CSV/PDF export |

### Dashboard

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/dashboard/live` | JWT | Who's clocked in right now, where |
| GET | `/api/dashboard/summary` | JWT | Today's stats |

### Feed & comments

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/feed` | JWT | Activity feed (role-scoped) |
| GET | `/api/comments` | JWT | List thread for a feed event |
| POST | `/api/comments` | JWT | Add comment |

### Team

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/team` | JWT | List members + roles |
| POST | `/api/team/invite` | JWT | Invite new member (admin+) |
| PUT | `/api/team/:id/role` | JWT | Change role (admin+) |
| PUT | `/api/team/:id/permissions` | JWT | Update permissions (admin+) |

### Push subscriptions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/push/subscribe` | JWT | Register push subscription |
| DELETE | `/api/push/subscribe` | JWT | Unregister |

### Audit

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/audit` | JWT | Audit log (admin + viewer) |

### Cron (internal)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/cron/auto-clock-out` | x-cron-secret | Every 5 mins — auto clock-out checks |
| POST | `/api/cron/overtime-calculation` | x-cron-secret | Midnight — recalculate overtime |
| POST | `/api/cron/shift-reminders` | x-cron-secret | Every 15 mins — push notifications |
| POST | `/api/cron/data-retention` | x-cron-secret | 2am daily — purge expired GPS/photos |

---

## Service Layer

All business logic in `src/lib/services/*.service.ts`. API routes are thin wrappers.

### clock.service.ts

**`clockIn(workerId, { latitude, longitude, ip, device, photoUrl, siteId, projectTag })`**
1. Check worker isn't already clocked in
2. If site has geofence → calculate distance via Haversine, set `is_within_geofence_in`
3. If outside geofence and strict mode → reject. If lenient → allow but flag, create feed event
4. If photo required and no photo → reject
5. Check for scheduled shift within early clock-in window → link entry to shift
6. Insert `ts_entries` row
7. Create feed event: `clock_in`

**`clockOut(workerId, { latitude, longitude, ip, device, photoUrl })`**
1. Find active entry
2. Capture GPS, check geofence
3. Calculate `total_break_minutes` from `ts_breaks`
4. Apply break rules: if auto_deduct and worker didn't take required break → add deduction
5. Calculate `total_worked_minutes`
6. Run overtime calculation
7. Set status = `pending_approval`
8. If linked shift → update shift status to `completed`
9. Create feed event, notify managers

**`startBreak(workerId, { latitude, longitude, breakType })`**
1. Find active entry, check no break in progress
2. Insert `ts_breaks` row
3. Create feed event

**`endBreak(workerId, { latitude, longitude })`**
1. Find active break
2. Set `end_at`, calculate `duration_minutes`
3. Create feed event. If over allowed time → feed event: `break_overtime`

### auto-clock-out.service.ts

Runs every 5 mins via cron. For each active entry:
1. Check if past shift end or past max hours
2. If triggered:
   - Get last GPS ping inside geofence
   - Resolve deduction_mode (worker override → workspace default)
   - **Auto mode:** dynamic = deduct from last in-fence ping; fixed = deduct configured minutes
   - **Flag for review:** no deduction, create feed event for manager
   - **None:** just log
3. Set `auto_clocked_out = true`, calculate totals
4. Feed event + push notify worker and manager

### overtime.service.ts

**`calculateOvertime(workerId, date)`**
1. Load effective overtime rules (worker overrides → workspace defaults)
2. Load entries for the relevant period
3. Apply rules in priority order: daily → weekly → night → consecutive day → holiday
4. Update `overtime_minutes` on affected entries
5. If threshold crossed → feed event: `overtime_alert`

### break-rules.service.ts

**`evaluateBreakCompliance(entryId)`**
1. Load effective break rules
2. Check if worker took required breaks
3. If auto_deduct enabled and break not taken → add to `total_break_minutes`
4. Create feed event if deduction applied

### approval.service.ts

- **`approveEntry`** — set status `approved`, optionally auto-lock, feed event, push notify worker
- **`rejectEntry`** — set status `rejected` with reason, feed event, push notify (deep links to comment thread)
- **`bulkApprove`** — approve multiple in a transaction
- **`bulkReject`** — reject multiple with shared reason
- **`lockEntry`** — set status `locked`, locked entries cannot be edited except by admin with audit trail

### gps.service.ts

**`recordPing(entryId, { latitude, longitude, accuracy })`**
1. Load site geofence
2. Calculate distance via Haversine formula
3. Insert `ts_gps_pings` row
4. If first out-of-fence ping → feed event: `left_geofence`
5. If returned → feed event: `returned_to_geofence`

**`isWithinGeofence(lat, lng, site)`** — Haversine distance calculation, returns `{ within, distance_metres }`

### feed.service.ts

Feed is **computed, not stored** — a VIEW over existing data to avoid duplication.

**`getFeed(userId, role, { page, limit })`**
- Staff: events where `worker_user_id = userId`
- Manager: events for all workers in their team
- Admin/viewer: all events for the workspace
- Joins with `ts_comments` for comment counts and unread indicators
- Returns paginated, reverse-chronological

Query unions `ts_entries` + `ts_breaks` + `ts_gps_pings` + `ts_audit_log`, ordered by timestamp. `ts_comments` attached via `entry_id` + `feed_event_type`.

### reports.service.ts

- **`attendanceReport`** — per worker per day: scheduled vs actual, late/early flags, hours, breaks, overtime
- **`hoursReport`** — per worker: total, regular, overtime by period
- **`overtimeReport`** — per worker: overtime hours by rule type, cost at multiplier
- **`labourCostReport`** — per worker/site/project: hours × rate, overtime × rate × multiplier
- **`gpsReport`** — verification rate, violations list, deductions applied
- **`exportReport`** — generates CSV or PDF

### shift.service.ts

- **`createShift`** — check for conflicts, insert, feed event + push notify
- **`createFromTemplate`** — generate shift instances across date range, assign workers
- **`cancelShift`** — set status `cancelled`, feed event + push notify

### settings.service.ts

Centralised override resolution. Every other service calls this.

**`getEffectiveSetting(workerId, settingName)`**
1. Check `ts_workers` override
2. If null → check `ts_sites` setting
3. If null → check `ts_settings` workspace default

**`getEffectiveBreakRules(workerId)`** and **`getEffectiveOvertimeRules(workerId)`** — load workspace rules, merge worker overrides.

### notification.service.ts

Web Push API with VAPID keys. Subscriptions stored in `ts_push_subscriptions`.

| Event | Who receives | When |
|-------|-------------|------|
| Shift reminder | Worker | Configurable: 15/30/60 mins before |
| Shift scheduled/cancelled | Worker | Immediately |
| Timesheet approved/rejected | Worker | Immediately |
| Auto clock-out | Worker + Manager | Immediately |
| Geofence violation | Manager | Immediately |
| New comment | Other party | Immediately |
| Pending approvals summary | Manager | Daily digest |
| Overtime threshold crossed | Manager + Worker | When hit |

Each notification includes a URL that deep-links to the relevant feed item.

---

## UI Screens

### Navigation

**Mobile bottom tabs by role:**

| Role | Tabs |
|------|------|
| Staff | Clock In, Feed, My Shifts, My Timesheets |
| Manager | Clock In, Feed, Schedule, Approvals, More |
| Admin | Clock In, Feed, Schedule, Dashboard, More |
| Viewer | Feed, Timesheets, Reports |

**Desktop:** CollapsibleSidebar with same sections expanded into sidebar groups.

### Screen list

**1. Clock In** (all roles)
The hero screen. Large clock-in button filling most of the viewport. Site selector (auto-detected from GPS or manual). Camera viewfinder if photo required. Once clocked in: live timer, "Take Break" button, "Clock Out" button. Status badge: "Verified Location — SE1 7PB" or "Outside geofence — manager will be notified."

**2. Feed** (all roles — the home screen)
Reverse-chronological activity stream. Each item: timestamp, icon, description. Items expandable inline to reveal comment thread + text input. Red dot on items with unread comments. Push notifications deep-link to feed items.

Staff feed: own clock events, approvals, rejections, deductions, shift assignments, overtime alerts.
Manager feed: team events, pending approvals, geofence violations, overtime alerts.
Admin feed: all workspace events including settings changes, team changes, GPS violation rates.

**3. My Shifts** (staff)
Upcoming scheduled shifts as card list. Date, time, site, project. "Clock In" shortcut on cards within the early window.

**4. My Timesheets** (staff)
History of completed entries. Filterable by week/month. Hours, breaks, overtime, status. Tap for detail with GPS map pins.

**5. Schedule** (manager+)
Calendar view (week default, toggle day/month). Colour-coded by site. Create shift: pick worker(s), site, date, times. Bulk create from template. Drag-and-drop on desktop, tap-to-create on mobile.

**6. Approvals** (manager+)
Pending entries as card list. Worker name, date, hours, site, GPS status, photo thumbnail. Swipe right/left on mobile for approve/reject. Bulk select + action buttons. Flag icons for: outside geofence, auto clocked out, overtime, missed break.

**7. Team** (manager+)
Worker list with current status (clocked in / on break / off). Tap for profile: hours this week, attendance rate, assigned site.

**8. Dashboard** (admin+, viewer)
Live map showing currently clocked-in workers as pins. Stats cards: total clocked in, on break, hours today, overtime alerts, unverified locations. "Who's not here" list for missed shifts.

**9. Reports** (manager+, viewer)
Tabbed: Attendance, Hours, Overtime, Labour Cost, GPS Verification. Date range picker + filters. Table view + export button. Charts: hours per worker, overtime trend, cost by site.

**10. Sites** (admin+)
CRUD list. Each site: name, address, map with draggable geofence radius circle, photo requirement toggle.

**11. Overtime Rules** (admin+)
Rule list with add/edit. Form: type, threshold, multiplier, conditions, priority.

**12. Break Rules** (admin+)
Rule list with add/edit. Form: after X hours, deduct Y minutes, paid/unpaid, auto-deduct toggle.

**13. Settings** (admin+)
Workspace config sections: GPS, Photos, Auto Clock-Out (mode, type, amount), Shifts, Notifications, Data Retention.

**14. Workers** (admin+)
Extends Team view with config tab: hourly rate, contracted hours, employment type, default site, overtime override, allowed sites, rule overrides.

**15. Audit Log** (admin, viewer)
Filterable chronological log.

**16. Profile** (all)
Own profile, delegates to 21auth for password changes.

### UX details

- Clock-in screen dominates for staff — the only thing they see when not clocked in
- Swipe gestures on mobile for approvals
- Pull-to-refresh on all list screens
- Framer Motion springs on all interactions
- Dark mode via `@relentify/ui` ThemeProvider
- Colour coding: green = verified/approved, amber = pending/flagged, red = rejected/violation (all via theme variables)

---

## PWA Implementation

### manifest.json

- `display: "standalone"` — fullscreen, no browser chrome
- `orientation: "portrait"`
- `theme_color` and `background_color` from `--theme-primary`
- Relentify branding icons (192px, 512px)

### Add to Home Screen

On first successful clock-in, show dismissable banner. Uses `beforeinstallprompt` on Chrome/Android. Manual instruction card for iOS Safari.

### Service Worker

**V1:** Cache app shell (HTML, CSS, JS, fonts, icons) — cache-first, updated in background. API responses: network-first with stale fallback. Clock actions require network. If offline: "No connection — waiting to reconnect."

**V2:** IndexedDB queue for offline punches. GPS captured locally. Photo stored as blob. Background Sync pushes on reconnect.

### GPS strategy

**Clock-in/out (high accuracy):** `enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 0` — satellite GPS, ~5m accuracy.

**Periodic pings (battery-friendly):** `enableHighAccuracy: false`, `timeout: 5000`, `maximumAge: 300000` — cell tower/wifi, ~50-200m accuracy, negligible battery.

**While app open:** `watchPosition` with low accuracy, only records a new ping when position changes by >50m.

**Admin configures ping interval:** 15 / 30 / 60 mins, or "checkpoints only."

**GPS captured at:** clock-in, break start, break end, clock-out (high accuracy) + periodic pings while open (low accuracy).

### Camera

Uses `<input type="file" accept="image/*" capture="user">` — opens front camera directly. Photo compressed client-side to <500KB. Uploaded to presigned S3/R2 URL, or stored as base64 in a `ts_photos` table (same pattern as 23inventory's `inv_photos`) if object storage is not yet configured. Upload fires in parallel with clock-in API call.

### Push notifications

Web Push API with VAPID keys. Registration on first visit with permission prompt. Subscription stored in `ts_push_subscriptions`. Each notification deep-links to relevant screen.

---

## Security & Compliance

### Access control

- Every API route: `getAuthUser()` → `checkPermission()`
- Staff: own data only (`worker_user_id = auth.userId`)
- Manager: scoped to their team (`manager_user_id` on `ts_workers`)
- Admin/owner: full workspace access
- Viewer: read-only, all mutations return 403

### Anti-fraud

| Measure | Implementation |
|---------|---------------|
| GPS verification | Coordinates at every clock action, compared against geofence |
| IP logging | Client IP on every punch |
| Device fingerprinting | User agent + screen size as JSONB |
| Photo verification | Selfie captured, reviewable by manager |
| Periodic GPS pings | Location checked during shift at configured interval |
| Geofence enforcement | Optional block on clock-in outside fence |
| Auto clock-out deduction | GPS-based deduction for unverified departures |
| Audit log | Every action logged |
| Timesheet locking | Approved entries cannot be modified |

### GDPR (UK)

- **Consent screen on first use:** explains what GPS data is collected and why
- **Worker can view all their own GPS data**
- **Retention policy** configurable per workspace: `gps_retention_days` (default 90), `photo_retention_days` (default 90). Entry records kept indefinitely for payroll/legal.
- **Cron: `/api/cron/data-retention`** — daily purge of expired GPS pings and photos
- **Data export** — worker can request CSV of all their data

### Rate limiting

- Clock actions: 10/min per user
- API reads: 100/min
- API writes: 30/min
- Photo upload: 5/min

### Input validation

- GPS: latitude -90 to 90, longitude -180 to 180
- Photos: max 5MB, JPEG/PNG only
- All text inputs sanitised
- Timestamps validated (clock-out after clock-in, break end after break start)
- Shift dates: can't schedule in the past

---

## Deployment

### Container

Port 3028, `infra_default` network. Resource limits: 0.50 CPU, 384M memory.

### Caddy

```
timesheets.relentify.com {
    reverse_proxy 28timesheets:3028 { ... }
}
```

### DNS

A record for `timesheets.relentify.com` → VPS IP in Cloudflare.

### Migrations

`apps/28timesheets/database/migrations/` numbered sequentially (001-009). Migration runner on app startup.

### Cron

```
*/5 * * * *   curl ... /api/cron/auto-clock-out
0   0 * * *   curl ... /api/cron/overtime-calculation
*/15 * * * *  curl ... /api/cron/shift-reminders
0   2 * * *   curl ... /api/cron/data-retention
```

### MCP tests

`/opt/infra/mcp/28timesheets-mcp/` with test modules: setup, teardown, clock, shifts, sites, workers, approval, overtime, breaks, reports, feed, settings, ui_checks.

---

## Version Roadmap

### V1 (launch)

Everything in this spec: clock in/out with GPS/IP/photo, geofencing, scheduled + ad-hoc shifts, break + overtime rules with per-worker overrides, auto clock-out with GPS deduction, approval workflow with bulk approve + locking, activity feed with comment threads, live dashboard, reports with export, push notifications, 5 roles, PWA.

### V2 (fast follow)

- Offline mode (service worker + IndexedDB + Background Sync)
- Kiosk mode (shared tablet, PIN entry, photo capture)
- PTO / time-off requests + balance tracking
- Shift swapping + open shifts
- Digital signatures on approved timesheets (reuse 27sign signature pad)
- Payroll export integration with 22accounting
- Recurring shift templates with auto-generation
- Scheduled email reports

### V3 (differentiator)

- GPS breadcrumb tracking with route map view
- Job costing with profitability reports
- AI auto-scheduling based on historical data + availability
- Team messaging (or integrate with 24reminders)
- Compliance engine (UK Working Time Regulations)
