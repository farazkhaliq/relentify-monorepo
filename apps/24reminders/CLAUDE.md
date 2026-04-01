# 24reminders — Claude Notes

**URL (planned):** https://reminders.relentify.com
**Container:** `24reminders` on port 3024
**Network:** `infra_default`
**Source:** `/opt/relentify-monorepo/apps/24reminders/` (pnpm + Turborepo monorepo)
**Next.js:** 15.5.14 (patched — above CVE-vulnerable 15.2.3)

---

## MCP Server

**Location:** `/opt/infra/mcp/24reminders-mcp/`
**Registered in:** `/root/.mcp.json` as `"24reminders"`
**Run tests:** `cd /opt/infra/mcp/24reminders-mcp && source venv/bin/activate && python3 run_tests.py`

### Architecture
- Two access layers: HTTP calls to `http://localhost:3024` + direct psycopg2 to `relentify` DB
- Test user UUID: `00000000-0000-4000-a000-000024240000` (inserted into shared `users` table)
- Setup creates: test user → workspace → General list
- Teardown deletes in FK order: audit → notifications → tasks → lists → workspaces → gamification → user

### Test results (2026-03-25) — 41/41 passed

```
[Diagnostics]        ✅ health check, db stats
[Task CRUD HTTP]     ✅ create (Normal/High/Urgent), list, verify count
[Task DB ops]        ✅ update status, verify persisted, delete, verify gone
[Subtasks]           ✅ create subtask 1+2, parent→InProgress, parent→Completed when all done
[Parent derivation]  ✅ status derived from subtask statuses, due_date = latest subtask
[Workspaces]         ✅ create (auto General list), list, verify ≥2 workspaces
[Lists]              ✅ create extra list, list, verify ≥2 lists per workspace
[Gamification]       ✅ award 10pts x2, verify points=20, streak=2, leaderboard
[Audit log]          ✅ log create + update, get logs, verify ≥2 entries
[Undo]               ✅ undo last update, verify task title reverted
[Notifications]      ✅ schedule email+telegram, get pending (≥2), mark sent, verify status
[UI Pages]           ✅ /dashboard, /momentum, /activity, /settings (4/4 × 200)
```

### MCP tools (26 total)

| Tool | Layer | Description |
|------|-------|-------------|
| `setup_test_env` | DB | Create test user + workspace + list, mint JWT |
| `teardown_test_env` | DB | Delete all test data |
| `health_check` | HTTP | GET /api/health |
| `db_stats` | DB | Row counts for all reminders tables |
| `create_task` | HTTP | POST /api/tasks |
| `list_tasks` | HTTP | GET /api/tasks?listId= |
| `update_task_db` | DB | Update task fields (no PATCH route exists) |
| `delete_task_db` | DB | Delete task (no DELETE route exists) |
| `get_task_db` | DB | Get task + parent_title |
| `create_subtask` | HTTP | POST /api/tasks with parent_task_id |
| `get_parent_derived_state` | DB | Read derived status + due_date of parent |
| `create_workspace` | DB | Insert workspace + auto General list |
| `list_workspaces` | DB | List workspaces for a user |
| `create_list` | DB | Insert named list in workspace |
| `list_lists` | DB | List all lists in workspace |
| `award_points` | DB | Upsert gamification (points + streak) |
| `get_gamification` | DB | Get gamification record for user |
| `get_leaderboard` | DB | Top N users by points |
| `log_audit` | DB | Insert audit log entry |
| `get_audit_logs` | DB | Get audit log with user + task names |
| `undo_last_action` | DB | Revert last 'update' action for user |
| `schedule_notification` | DB | Insert pending notification |
| `get_pending_notifications` | DB | Overdue pending notifications |
| `mark_notification_sent` | DB | Update notification status to 'sent' |
| `get_notification` | DB | Get single notification by ID |
| `check_page_routes` | HTTP | GET 4 UI pages, verify landmark text |

---

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| GET/POST | `/api/tasks` | Yes | List tasks (by listId) / create task |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Yes | Get / update / delete task (added 2026-03-28) |
| GET/POST | `/api/workspaces` | Yes | List / create workspace |
| GET/POST | `/api/workspaces/[id]/lists` | Yes | List / create lists in workspace |

**Total**: 5 route files, 10 HTTP methods

### Missing API routes (service exists, no endpoint)
| Missing route | Service function | Notes |
|---------------|-----------------|-------|
| `GET /api/gamification/leaderboard` | `getLeaderboard()` | DB-only |
| `POST /api/audit/undo` | `undoLastAction()` | DB-only |
| `POST /api/notifications` | `scheduleNotification()` | DB-only |

---

## UI Pages

| Path | Auth | Purpose |
|------|------|---------|
| `/` | Yes | Home / redirect |
| `/dashboard` | Yes | Main task dashboard |
| `/dashboard/activity` | Yes | Activity log |
| `/dashboard/momentum` | Yes | Momentum mode (focus timer) |
| `/dashboard/settings` | Yes | User settings |

**Total**: 5 pages

---

## Feature Status (2026-03-25 assessment)

### ✅ Implemented and tested

| Feature | Notes |
|---------|-------|
| **Task creation** | All fields: title, description, status, priority, due_date, start_date, owners, heads_up, custom_fields |
| **Task listing** | GET /api/tasks?listId — returns tasks + parent_title via LEFT JOIN |
| **Task update** | Service function works; **no HTTP PATCH route** — DB-direct only |
| **Task delete** | Service function works; **no HTTP DELETE route** — DB-direct only |
| **Subtasks** | Created as regular tasks with parent_task_id |
| **Parent status derivation** | All completed/cancelled → Completed; any in-progress → In Progress; else To Start |
| **Parent due_date derivation** | Derived as MAX(subtask due_dates); cascades up nested tree |
| **Nested subtasks** | Recursive `deriveParentTaskUpdates` walks full ancestor chain |
| **Workspaces** | Create, list; workspace creation auto-generates General list |
| **Lists** | Create, list per workspace |
| **Gamification** | Points upsert + streak logic (24h window); leaderboard query |
| **Audit log** | Create entries with old/new values; get log with names; undo last update |
| **Notifications** | Schedule (email/telegram), query pending, mark sent |
| **UI pages** | /dashboard, /momentum, /activity, /settings — all return 200 |

### ❌ Missing API routes (service exists, no HTTP endpoint)

These features have service-layer code but no API routes wired up — the frontend uses local state only:

| Missing route | Service function | Impact |
|---------------|-----------------|--------|
| `GET /api/gamification/leaderboard` | `getLeaderboard()` | Leaderboard not displayed anywhere |
| `POST /api/audit/undo` | `undoLastAction()` | Undo not accessible from UI |
| `POST /api/notifications` | `scheduleNotification()` | Notifications never scheduled from UI |

### ✅ Routes added 2026-03-28 (System 1)

| Route | Notes |
|-------|-------|
| `GET/PATCH/DELETE /api/tasks/:id` | Full CRUD; PATCH triggers deriveParentTaskUpdates + audit log |
| `GET/POST /api/workspaces` | List + create workspaces |
| `GET/POST /api/workspaces/:id/lists` | List + create lists per workspace |

### ⚠️ Partially implemented (UI exists, no backend)

| Feature | Status |
|---------|--------|
| **Momentum mode Done button** | ✅ Fixed 2026-03-28 — calls PATCH /api/tasks/:id { status: Completed } |
| **Momentum Snooze button** | ✅ Fixed 2026-03-28 — calls PATCH /api/tasks/:id { due_date: +24h } |
| **Momentum Schedule button** | UI only, no-op |
| **Settings: Telegram** | Connect button renders, no backend |
| **Settings: Email digests** | Toggle renders, no backend |
| **Settings: Leaderboard opt-in** | Toggle renders, no backend |
| **Recurring tasks** | `recurring_rule` field in schema; no task-generation logic |
| **Task dependencies/triggers** | Not built |
| **Task decay (dormant)** | Not built |
| **Quick capture (NLP box)** | Not built |
| **Telegram bot** | Not built |
| **Badge logic** | `badges` column in schema; no award logic |

### ❌ Not built (roadmap)

- Linked/dependent tasks (auto-adjust due dates)
- Triggered tasks (auto-create on completion/cancellation)
- Recurring task generation
- Telegram bot integration
- Email sending (scheduler + Resend/SMTP)
- Badge award system
- Task decay / dormant tasks view
- NLP quick-capture box
- Multi-workspace UI switcher

---

## Tech Stack

- Next.js 15.5.14 App Router (TypeScript)
- PostgreSQL shared `relentify` DB via raw `pg.Pool` (not Prisma)
- Auth: shared JWT cookie `relentify_token` via `@relentify/auth`
- Framer Motion for Momentum mode animations
- `@relentify/ui` for NavShell, TopBar, UserMenu

## Database Tables

All in `relentify` DB:
- `reminders_workspaces` — id, name, owner_id, settings
- `reminders_lists` — id, workspace_id, name, description
- `reminders_tasks` — full task model; subtasks use `parent_task_id`
- `reminders_notifications` — id, task_id, user_id, channel, scheduled_time, status, snooze_count
- `reminders_gamification` — user_id (unique), points, streak_count, badges, last_completed_at
- `reminders_audit_log` — id, workspace_id, user_id, action, task_id, old_value, new_value, timestamp

## Deployment

```bash
cd /opt/relentify-monorepo
docker compose -f apps/24reminders/docker-compose.yml down
docker compose -f apps/24reminders/docker-compose.yml build --no-cache
docker compose -f apps/24reminders/docker-compose.yml up -d
docker logs 24reminders --tail 50
```

---

## Implementation Plan — Next Phase (2026-03-26)

Five systems to build. Each self-contained. Build in order (1→5).

---

### System 1: Core CRUD Routes + Frontend Wiring

**Why first**: everything else depends on tasks persisting correctly.

**API routes to add:**

`app/api/tasks/[id]/route.ts` — new file:
- `GET /api/tasks/:id` — fetch single task (for detail/edit panels)
- `PATCH /api/tasks/:id` — call `updateTask(id, body, userId)` from task.service; run `deriveParentTaskUpdates` if status changed; log to audit; return updated task
- `DELETE /api/tasks/:id` — soft-delete (set `deleted_at = NOW()`) or hard delete; audit log it; return `{ ok: true }`

**Frontend wiring:**

`TaskDashboard.tsx` — currently uses local state only:
- On status change (checkbox/select): `PATCH /api/tasks/:id` with `{ status }`
- On task delete: `DELETE /api/tasks/:id`, remove from local state
- On edit save (title, due_date, priority, etc.): `PATCH /api/tasks/:id`

`MomentumView.tsx` — "Done" button currently awards points but never persists:
- Done → `PATCH /api/tasks/:id { status: 'Completed' }` first, then award points
- Snooze → `PATCH /api/tasks/:id { due_date: now+24h }` (saves reschedule to DB)

**Workspace + List API routes** — new files:
- `app/api/workspaces/route.ts`: `GET` → `getWorkspaces(userId)`, `POST` → `createWorkspace(name, userId)`
- `app/api/workspaces/[id]/lists/route.ts`: `GET` → `getLists(workspaceId)`, `POST` → `createList(workspaceId, name)`

---

### System 2: Notifications

**DB migration needed:**

Add to `users` table (new migration file):
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS reminder_default_offset_minutes INTEGER DEFAULT 1440, -- 1 day
  ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_digest_hour INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS gamification_enabled BOOLEAN DEFAULT TRUE;
```

Add to `reminders_tasks` (task-level override):
```sql
-- notification_prefs column already exists (jsonb) — store override here
-- schema: { offset_minutes: number | null, channels: ['email','telegram'] | null }
-- null = use user's universal default
```

**Notification scheduling logic** (`src/lib/notification.service.ts`):

New function `scheduleTaskNotifications(task, user)`:
1. Read `task.notification_prefs.offset_minutes` — if null, use `user.reminder_default_offset_minutes`
2. If task has no `due_date` → skip
3. `fire_at = due_date - offset_minutes`
4. If `fire_at < now` → cascade: try `due_date - 10min`; if still past → skip
5. For each channel in `task.notification_prefs.channels ?? ['email']` (+ `'telegram'` if user has `telegram_id`):
   - Insert row into `reminders_notifications`
6. Call this from `POST /api/tasks` after task creation, and from `PATCH /api/tasks/:id` when `due_date` changes (delete old pending notifications first)

**Cron route** — `app/api/cron/notifications/route.ts` (already scaffolded pattern from 22accounting):
- GET → query `getPendingNotifications()` (due, status=pending)
- For each: send email (Resend) or Telegram message
- Mark sent

**Email sending** — add `resend` package, create `src/lib/email.ts`:
- `sendReminderEmail(to, taskTitle, dueDate)` — simple plain transactional email

**Telegram sending** — add `src/lib/telegram.ts`:
- `sendTelegramMessage(chatId, text)` — HTTP POST to `https://api.telegram.org/bot{BOT_TOKEN}/sendMessage`
- `BOT_TOKEN` + `TELEGRAM_BOT_NAME` in `.env`

**Telegram connect flow** — `app/api/telegram/connect/route.ts`:
- Generates a one-time connect URL: `https://t.me/{BOT_NAME}?start=connect_{userId_token}`
- Bot webhook (`/api/telegram/webhook`) receives `/start connect_{token}` → resolves userId → saves `telegram_id` + `telegram_username` to `users`

**Settings page wiring** (`app/dashboard/settings/page.tsx`):
- Convert from static render to client component
- "Connect Telegram" button → calls `/api/telegram/connect` → opens Telegram link in new tab
- Show "Connected as @username" once `telegram_id` is set
- Email digest toggle → `PATCH /api/user/settings { email_digest_enabled, email_digest_hour }`
- Universal default reminder → dropdown (None / 10min / 1hr / 1 day / 2 days / 1 week) → saves `reminder_default_offset_minutes`
- Gamification opt-out toggle → saves `gamification_enabled`

**Task form** — "More options" section:
- Add "Remind me" dropdown (same options as universal default, plus "Use my default") → stored in `task.notification_prefs.offset_minutes`
- Channel checkboxes: Email / Telegram (only show Telegram if user has connected it)

**New API route** `app/api/user/settings/route.ts`:
- `PATCH` → update `reminder_default_offset_minutes`, `email_digest_enabled`, `email_digest_hour`, `gamification_enabled` on `users` table

---

### System 3: Recurring Tasks

**Rule format** (stored in `task.recurring_rule` jsonb column):

```json
{
  "mode": "after_completion" | "on_schedule",
  "frequency": "daily" | "weekly" | "monthly" | "custom",
  "days_of_week": [1,3,5],        // 0=Sun, 1=Mon... (weekly)
  "day_of_month": 15,             // (monthly, fixed date)
  "day_of_month_mode": "fixed" | "first_weekday" | "last_weekday" | "every_n",
  "every_n": 2,                   // "every 2 weeks" (with frequency=weekly)
  "end_date": "2026-12-31"        // optional
}
```

**Task form UI** — "Repeat" toggle under "More options":
- Mode selector: "After I complete it" / "On a set schedule"
- Frequency: Daily / Weekly (pick days) / Monthly (pick day or first/last weekday) / Every N (number + unit)
- End date (optional)

**Next-occurrence generator** — `src/lib/recurring.service.ts`:
- `getNextOccurrence(rule, fromDate): Date | null` — pure function, no DB calls

**Cron job** — `app/api/cron/recurring/route.ts`:
- Query tasks where `recurring_rule IS NOT NULL AND status = 'Completed'` AND no future sibling exists
- For each: call `getNextOccurrence(rule, completed_at)`; create new task cloned from template with title `"${originalTitle} · ${formatDate(nextDate)}"`, due_date = nextOccurrence, status = 'To Start'
- `on_schedule` mode: same but trigger off `due_date` passing rather than completion

---

### System 4: Badges

**Badge definitions** (hardcoded in `src/lib/badges.ts`):

| ID | Name | Trigger |
|----|------|---------|
| `first_task` | First Step | Complete first ever task |
| `streak_3` | On a Roll | 3-day streak |
| `streak_7` | Week Warrior | 7-day streak |
| `streak_30` | Unstoppable | 30-day streak |
| `points_100` | Century | 100 points |
| `points_1000` | Legend | 1000 points |
| `early_bird` | Early Bird | Complete task before 9am |
| `night_owl` | Night Owl | Complete task after 10pm |
| `speed_run` | Speed Run | Complete 5 tasks in one day |
| `deck_cleared` | Deck Cleared | Complete all tasks in Momentum mode |

**Award logic** (`src/lib/gamification.service.ts`):

New function `checkAndAwardBadges(userId, trigger)`:
- Read current `badges` array + stats from `reminders_gamification`
- Check each badge rule — award if not already held
- `UPDATE reminders_gamification SET badges = badges || $newBadge` for each new badge
- Return array of newly-earned badges

Call `checkAndAwardBadges` from:
- `PATCH /api/tasks/:id` when status→Completed (after `awardPoints`)
- `MomentumView.tsx` Done handler (via existing `/api/tasks/:id` PATCH, returned in response)

**Frontend badge moment** (`MomentumView.tsx`):
- PATCH response includes `{ newBadges: [{ id, name, description }] }`
- If `newBadges.length > 0` → show badge overlay (1-2s) with confetti burst before advancing to next task
- Use `canvas-confetti` package for the burst
- "Deck Cleared" screen: if `newBadges` includes `deck_cleared` → full-screen celebration instead of normal cleared screen

**Leaderboard** (`app/dashboard/page.tsx` — add a section):
- `GET /api/gamification/leaderboard` — new route calling `getLeaderboard(10)`
- Small widget in dashboard showing top 5 with points + streak
- Only shown if `gamification_enabled = true` for the user

---

### System 5: Settings + Workspace/List Switching (Frontend)

This wires up the remaining UI shells that exist but have no backend.

**Settings page** (fully reactive client component):
- Load current user prefs on mount: `GET /api/user/settings` (new route)
- All toggles/dropdowns save immediately on change (no Save button)
- Shows current Telegram connection status; "Disconnect" option if connected

**Workspace switcher** (top bar or sidebar):
- `GET /api/workspaces` → list workspaces
- Active workspace stored in `reminders_workspaces` settings or local cookie
- Switch workspace → update active workspace cookie → reload lists + tasks
- "New workspace" inline form (hidden by default)

**List tabs** (within workspace):
- `GET /api/workspaces/:id/lists` → list lists
- Horizontal tab strip above task table: General | Work | Personal | + New List
- Click tab → update `?listId=` in URL → TaskDashboard re-fetches

**New API route** `app/api/user/settings/route.ts`:
- `GET` → return `{ reminder_default_offset_minutes, email_digest_enabled, email_digest_hour, gamification_enabled, telegram_id, telegram_username }`
- `PATCH` → update allowed fields

---

## Execution Order

```
System 1 (Core CRUD)         ← foundation, build first
System 2 (Notifications)     ← needs CRUD + DB migration
System 3 (Recurring)         ← needs CRUD + cron pattern
System 4 (Badges)            ← needs CRUD + gamification service
System 5 (Settings/Workspaces) ← can interleave, needs System 2 for Telegram
```

After all 5: run the MCP test suite, update test count in CLAUDE.md, rebuild Docker image.

---

## Original Vision for 24reminders — Reference Spec

This document is the original requirements prompt that defined what 24reminders was supposed to be. It is preserved here so we can assess what the current app actually implements vs. what was originally intended.

---

## Core Requirements

### 1. Tasks
- Each task includes: title, owners (multiple), optional due date, optional start date, status (default: To Start → In Progress → Completed → Cancelled), heads-up users, priority (default normal), custom fields (optional).
- Tasks can have **subtasks**; subtasks are **regular tasks with a parent task**:
  - Parent task is read-only (no edits, no notes).
  - Parent due date = latest due date among its subtasks.
  - Status of parent derives from subtasks.
  - Subtasks displayed with subtle line under parent; zero indentation in list/table.
  - Subtasks appear normally in all views: table, list, Kanban, calendar, Gantt.
  - Table view should include a column: "Parent task".
  - Nested subtasks allowed indefinitely.

- Tasks can be **linked/dependent**:
  - If a previous task is delayed, next tasks in the chain optionally auto-adjust.
  - Task can be triggered when another task is completed or cancelled.

- Tasks can be **recurring**:
  - Options: only create new task after previous is completed, or auto-create on schedule.
  - New task shows original schedule clearly (e.g., "Task from Fri 13 Mar").

---

### 2. Views
- List view: Excel-style compact table.
- Table, Kanban, Gantt, Calendar.
- Triage mode: one task at a time.
- Momentum mode: full-page or modal overlay, focus on **one task at a time**, with gamification.
- Mobile-friendly for all views.

---

### 3. Momentum Mode
- Shows **one task at a time** in large card.
- Buttons: Done, Snooze (default 24h), Reschedule, Skip, Open full task, See all tasks.
- Gamification:
  - Points per completed task, streaks, badges, leaderboard.
  - Positive reinforcement only (no penalties).
  - "Deck cleared" message when all tasks completed.
- Progress indicator: "Task X of Y".
- Works in web UI only (email/Telegram remain functional but no gamification).

---

### 4. Notifications
- Channels: email and Telegram.
- Defaults set by admin, editable per task by creator:
  - Reminder interval (minutes, hours, days, weeks, months, years)
  - Minimum reminder gap: 10 minutes
  - Escalation to heads-up users if overdue
- Heads-up users always notified; cannot be turned off.
- Users can turn on/off daily digest and select delivery time.

---

### 5. Undo and Audit
- Reliable undo for all task actions: status changes, edits, deletions, moves.
- Full **audit log**:
  - Users see all their changes in Settings → My Activity.
  - Admin sees all workspace actions, filterable by user, task, action, date.
  - Audit shows previous and new values, who did it, and when.

---

### 6. Subtasks & Parent Logic
- Parent tasks cannot have edits/notes.
- Progress, due date, and completion derived **entirely from subtasks**.
- Table view includes "Parent task" column for reference.
- Subtasks behave as normal tasks in Kanban, Gantt, Calendar, and List.

---

### 7. Quick Capture
- Web: NLP-style quick-add box (title + optional due date + optional owners).
- Telegram: buttons/forms to create tasks, view today's or week's agenda, or see outstanding tasks.

---

### 8. Defaults & Complexity
- Default workspace + default list provided.
- Users can create extra lists/workspaces (optional toggle in settings).
- Advanced options (custom fields, notification overrides, recurring, etc.) are **hidden by default**, accessible via "More Options" toggle in task creation.
- Minimize decision fatigue.

---

### 9. Task Decay
- Tasks untouched for X days (default 60) appear in Dormant Tasks.
- Users can: Keep (reschedule), Close (mark as not relevant), Review.
- Sends optional email/Telegram summary of dormant tasks.

---

### 10. Gamification
- Points system for task completion.
- Streaks for consecutive task completion.
- Badges and leaderboard in workspace for friendly competition.
- All optional and can be disabled in settings per user.

---

### 11. Linked/Triggered Tasks
- Internal only, no external integrations yet.
- Triggered tasks: create automatically when another task is completed/cancelled.
- Linked tasks: auto-adjust due dates if prior task delayed (optional).

---

### 12. Mobile First
- All functionality (table, Kanban, Gantt, calendar, momentum mode) fully functional on mobile browsers.
- Buttons and interactions touch-friendly.
- Views consistent with web.

---

### 13. Gamification + UI Polish
- Momentum mode, streaks, points, badges, "deck cleared".
- Clear visual hierarchy for tasks, subtasks, parent tasks.
- Compact, readable, no unnecessary distractions.
- Warning modal for tasks without due date: before submission and confirmation after creation.

---

## Backend & Data

- PostgreSQL database schema for tasks, subtasks, dependencies, audit logs, notifications, gamification.
- Ready to send reminders via email and Telegram.
- Triggered task architecture prepared for future event-based workflows.

---

## Data Model

```
┌────────────────────┐
│      Users         │
├────────────────────┤
│ user_id (PK)       │
│ name               │
│ email              │
│ telegram_id        │
│ is_admin (bool)    │
│ workspace_id (FK)  │
│ notification_prefs │
│ gamification_score │
└────────────────────┘
          │ 1-to-many
          ▼
┌────────────────────┐
│    Workspaces      │
├────────────────────┤
│ workspace_id (PK)  │
│ name               │
│ owner_user_id (FK) │
│ default_settings   │
└────────────────────┘
          │ 1-to-many
          ▼
┌────────────────────┐
│      Lists         │
├────────────────────┤
│ list_id (PK)       │
│ workspace_id (FK)  │
│ name               │
│ description        │
└────────────────────┘
          │ 1-to-many
          ▼
┌───────────────────────────┐
│          Tasks            │
├───────────────────────────┤
│ task_id (PK)              │
│ list_id (FK)              │
│ title                     │
│ description               │
│ owners [user_id array]    │
│ heads_up [user_id array]  │
│ parent_task_id (FK, NULL) │
│ due_date                  │
│ start_date                │
│ status (enum)             │
│ priority                  │
│ recurring_rule            │
│ linked_task_id (FK, NULL) │
│ created_by (user_id FK)   │
│ completed_at              │
│ notification_prefs        │
└───────────────────────────┘
          │ 1-to-many
          ▼
┌───────────────────────────┐
│       Subtasks            │
├───────────────────────────┤
│ task_id (PK)              │
│ parent_task_id (FK)       │
│ ... inherits from Tasks   │
└───────────────────────────┘
(*Stored in Tasks table; parent_task_id marks hierarchy*)
          │ 1-to-many
          ▼
┌───────────────────────────┐
│     Task Dependencies     │
├───────────────────────────┤
│ dependency_id (PK)        │
│ task_id (FK)              │
│ dependent_task_id (FK)    │
│ type (enum: delay/notification) │
└───────────────────────────┘
          │ 1-to-many
          ▼
┌───────────────────────────┐
│     Notifications         │
├───────────────────────────┤
│ notification_id (PK)      │
│ task_id (FK)              │
│ user_id (FK)              │
│ channel (email/telegram)  │
│ scheduled_time            │
│ status (sent/pending)     │
│ snooze_count              │
└───────────────────────────┘
          │ 1-to-many
          ▼
┌───────────────────────────┐
│        Audit Log          │
├───────────────────────────┤
│ audit_id (PK)             │
│ task_id (FK, NULLABLE)    │
│ user_id (FK)              │
│ action (enum)             │
│ old_value                 │
│ new_value                 │
│ timestamp                 │
└───────────────────────────┘
          │ 1-to-many
          ▼
┌───────────────────────────┐
│      Gamification         │
├───────────────────────────┤
│ gamification_id (PK)      │
│ user_id (FK)              │
│ points                    │
│ streak_count              │
│ badges [text array]       │
└───────────────────────────┘
```

---

## Design Decisions

- **Subtasks** stored in the same Tasks table; `parent_task_id = null` for top-level, non-null for subtasks. Nested subtasks allowed indefinitely.
- **Linked/Dependent tasks** allow auto-adjust of due dates or notification-only dependencies.
- **Notifications** — each task can generate multiple notifications per user, per channel. Minimum interval 10 min, escalation to heads-up users.
- **Audit Log** — captures everything including edits, status changes, comment edits/deletions. Supports undo.
- **Gamification** — points/streaks/badges per user, independent of task data.

---

## Features This Architecture Was Designed to Support

- Momentum mode (one task at a time with gamification)
- Subtasks hierarchy (indefinitely nested)
- Notification intelligence and escalation
- Task decay / dormant task handling
- Quick capture via web (NLP) or Telegram
- Recurring tasks
- Event-triggered and linked/dependent tasks

---

## UI Notes

- Do not create a completely new style; reuse existing UI components, fonts, colors, buttons, spacing, and layout.
- Add pages to the existing app seamlessly.
- Ensure all features listed above are fully implemented.

---

## Assessment Checklist — Does 24reminders implement this?

Use this to compare the original vision against what is currently built:

**Task Model**
- [ ] Multiple owners per task
- [ ] Heads-up users (always notified, cannot be turned off)
- [ ] Start date field
- [ ] Custom fields
- [ ] Subtasks (stored as tasks with parent_task_id)
- [ ] Parent task is read-only (no edits, no notes)
- [ ] Parent due date = latest subtask due date
- [ ] Parent status derived from subtasks
- [ ] Subtasks display with subtle line under parent, zero indentation
- [ ] Nested subtasks (indefinitely)
- [ ] Recurring tasks (two modes: after-completion and scheduled)
- [ ] Recurring task shows original schedule label

**Dependencies**
- [ ] Linked tasks (auto-adjust due dates if prior delayed)
- [ ] Triggered tasks (auto-create when another completes/cancels)
- [ ] Task Dependencies table in DB

**Views**
- [ ] List view (Excel-style compact table)
- [ ] Table view with "Parent task" column
- [ ] Kanban view
- [ ] Gantt view
- [ ] Calendar view
- [ ] Triage mode
- [ ] Momentum mode

**Momentum Mode**
- [ ] One task at a time in large card
- [ ] Done / Snooze (24h) / Reschedule / Skip / Open full task / See all tasks buttons
- [ ] Points per completed task
- [ ] Streaks
- [ ] Badges
- [ ] Leaderboard
- [ ] "Deck cleared" message
- [ ] Progress indicator (Task X of Y)

**Notifications**
- [ ] Email channel
- [ ] Telegram channel
- [ ] Per-task notification override (interval, channel)
- [ ] Minimum 10-minute gap enforced
- [ ] Escalation to heads-up users if overdue
- [ ] Daily digest (on/off, user selects time)

**Undo & Audit**
- [ ] Undo for status changes
- [ ] Undo for edits
- [ ] Undo for deletions
- [ ] Undo for moves
- [ ] Audit log (all actions with old/new values, user, timestamp)
- [ ] Settings → My Activity (per-user audit view)
- [ ] Admin audit view (filterable by user, task, action, date)

**Quick Capture**
- [ ] NLP-style quick-add box on web
- [ ] Telegram bot: create task
- [ ] Telegram bot: view today's agenda
- [ ] Telegram bot: view week's agenda
- [ ] Telegram bot: view outstanding tasks

**Workspaces & Lists**
- [ ] Default workspace + default list on signup
- [ ] User can create extra workspaces (optional, settings toggle)
- [ ] User can create extra lists

**Task Complexity UX**
- [ ] Advanced options hidden by default
- [ ] "More Options" toggle reveals: custom fields, notification overrides, recurring, etc.
- [ ] Warning modal for tasks without due date

**Task Decay**
- [ ] Dormant Tasks section (tasks untouched for X days, default 60)
- [ ] Actions: Keep (reschedule), Close, Review
- [ ] Email/Telegram summary of dormant tasks (optional)

**Gamification**
- [ ] Points system
- [ ] Streaks
- [ ] Badges
- [ ] Leaderboard
- [ ] Per-user opt-out in settings

**Mobile**
- [ ] All views functional on mobile
- [ ] Touch-friendly buttons/interactions
