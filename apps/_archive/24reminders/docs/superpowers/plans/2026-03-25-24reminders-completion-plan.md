# 24reminders — Completion Plan
**Date:** 2026-03-25
**Status:** Ready to implement

This plan fixes all known gaps in 24reminders in five phases. Each phase is independently deployable.

---

## Build Order

| Phase | What | Why first |
|-------|------|-----------|
| 1 | Core CRUD | Everything else depends on tasks persisting |
| 2 | Notifications | Needs tasks to exist; needs settings for defaults |
| 3 | Recurring tasks | Needs PATCH route from Phase 1 |
| 4 | Badges | Needs completion events from Phase 1 |
| 5 | Settings backend | Pulls together all the above |

---

## Phase 1 — Core CRUD Fix

**Problem:** Task edits, completions, and deletes only update React local state. Nothing persists to DB. Workspace/list management has no HTTP layer.

### DB migrations
None — schema is complete.

### New files
- `app/api/tasks/[id]/route.ts` — PATCH (updateTask) + DELETE (delete by id, cascade check)
- `app/api/workspaces/route.ts` — GET (getWorkspaces for user) + POST (createWorkspace, auto-creates General list)
- `app/api/lists/route.ts` — GET (?workspaceId=) + POST (createList)

### Changed files
- `src/components/TaskDashboard.tsx`
  - `handleCreateTask` → POST /api/tasks (already wired, but confirm response handling)
  - `handleUpdateTask` → PATCH /api/tasks/[id]
  - `handleDeleteTask` → DELETE /api/tasks/[id]
  - Re-fetch task list after mutations
- `src/components/MomentumView.tsx`
  - "Done" button → PATCH /api/tasks/[id] `{ status: "Completed", completed_at: now }`
  - Returns newly awarded badges (from Phase 4 hook — stub for now)
- `app/(main)/page.tsx`
  - Load workspaces via GET /api/workspaces, pick first
  - Load lists via GET /api/lists?workspaceId=, pick first
  - Pass workspaceId + listId down to TaskDashboard

### Key logic
- PATCH route: accepts any subset of task fields; calls updateTask service; if task has parent_task_id, deriveParentTaskUpdates runs automatically (already in service)
- DELETE route: deletes task + all its subtasks (WHERE id = $1 OR parent_task_id = $1)
- Auth: all routes require JWT, filter by userId where appropriate

### MCP tests to add
- PATCH /api/tasks/[id] — update title, status, priority
- DELETE /api/tasks/[id] — verify task + subtasks gone
- GET/POST /api/workspaces
- GET/POST /api/lists

---

## Phase 2 — Notifications

**Design:** Users set a universal default in Settings. Per-task overrides available under "More options" in the task form. Email via Resend. Telegram via Bot API. If calculated reminder time is already past, cascade: try 1h before → 15min before → skip with inline note.

### DB migrations

```sql
-- User notification settings
CREATE TABLE reminders_user_settings (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notif_channel  TEXT    NOT NULL DEFAULT 'email',       -- 'email' | 'telegram' | 'both'
  notif_minutes  INT     NOT NULL DEFAULT 1440,          -- minutes before due (1440 = 1 day)
  telegram_chat_id TEXT,                                  -- set when user connects Telegram
  digest_enabled BOOLEAN NOT NULL DEFAULT false,
  digest_time    TIME    NOT NULL DEFAULT '08:00',
  leaderboard_on BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`reminders_tasks.notification_prefs` JSON already exists for per-task overrides — no schema change needed.
Structure: `{ "channel": "telegram", "minutes_before": 60, "disabled": true }`

### New files
- `src/lib/notification_sender.service.ts`
  - `sendEmail(to, subject, body)` — Resend API
  - `sendTelegram(chatId, text)` — Telegram Bot API (`https://api.telegram.org/bot{TOKEN}/sendMessage`)
  - `processNotification(notification)` — dispatches to correct sender, marks sent
- `app/api/cron/notifications/route.ts`
  - GET /api/cron/notifications (secured by CRON_SECRET header)
  - Calls getPendingNotifications() → processNotification() for each
- `app/api/settings/notifications/route.ts`
  - GET — fetch reminders_user_settings for current user (create row with defaults if not exists)
  - PATCH — update settings fields

### Changed files
- `app/api/tasks/route.ts` POST — after createTask, if due_date exists: calculate reminder time from user settings (or task notification_prefs override), cascade fallback if in past, call scheduleNotification
- `app/api/tasks/[id]/route.ts` PATCH — if due_date changes: delete existing pending notifications for task, reschedule with new time
- `src/components/TaskForm.tsx` — under "Advanced Options":
  - Notification override toggle (use default / custom / off)
  - If custom: channel selector (email / telegram / both) + minutes-before input
- `app/(main)/dashboard/settings/page.tsx` — wire up:
  - Default channel (email / telegram / both)
  - Default timing (dropdown: 15min / 1h / 3h / 1 day / 2 days / 1 week / custom)
  - Telegram: "Connect Telegram" → shows instructions + field to paste chat_id
  - Email digest: toggle + time picker

### Environment variables needed
```
RESEND_API_KEY=...
TELEGRAM_BOT_TOKEN=...
CRON_SECRET=...          # shared secret for cron endpoint auth
```

### Telegram connect flow
Simple for now: Settings page shows the bot username + instruction:
> "Message @YourBot and type /start — you'll receive your Chat ID. Paste it here."
User pastes their chat_id → saved to reminders_user_settings.telegram_chat_id.

### Cascade fallback logic (in notification scheduling)
```
calculated_time = due_date - user_default_minutes
if calculated_time <= now:
  try due_date - 60min
  if still <= now: try due_date - 15min
  if still <= now: skip, set task.notification_prefs.skipped_reason = "due_too_soon"
```

### MCP tests to add
- Create reminders_user_settings row, fetch it
- Schedule notification via task creation (verify row in reminders_notifications)
- Verify cascade fallback creates notification at shorter interval
- Cron endpoint fires, marks notification sent

---

## Phase 3 — Recurring Tasks

**Design:** Two modes. "After completion" generates next occurrence when task is marked done. "On schedule" has a cron job that pre-generates instances N days ahead. Scheduled instances get a date label appended to their title: "Weekly Review · Mon 23 Mar".

### DB migrations

```sql
-- Add to reminders_tasks
ALTER TABLE reminders_tasks
  ADD COLUMN recurring_template_id UUID REFERENCES reminders_tasks(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_for         TIMESTAMPTZ;

-- Index for cron job query
CREATE INDEX idx_tasks_template ON reminders_tasks(recurring_template_id) WHERE recurring_template_id IS NOT NULL;
```

### recurring_rule JSON schema

```json
{
  "mode": "schedule",
  "pattern": {
    "type": "weekly",
    "days_of_week": [1],
    "hour": 9,
    "minute": 0
  },
  "advance_days": 14,
  "end_date": null
}
```

```json
{
  "mode": "after_completion",
  "pattern": {
    "type": "monthly",
    "day_of_month": 15
  }
}
```

```json
{
  "mode": "schedule",
  "pattern": {
    "type": "nth_weekday",
    "nth": 1,
    "day": 1
  }
}
```

```json
{
  "mode": "schedule",
  "pattern": {
    "type": "interval",
    "unit": "weeks",
    "every": 2
  }
}
```

Pattern types: `daily`, `weekly` (days_of_week[]), `monthly` (day_of_month), `nth_weekday` (nth + day), `interval` (unit + every), `cron` (raw cron string for power users).

### New files
- `src/lib/recurring.service.ts`
  - `getNextOccurrence(rule, after: Date) → Date | null` — given rule + reference date, returns next scheduled date
  - `generateInstance(templateTask, scheduledFor: Date) → Task` — clones template, appends "· Mon 23 Mar" to title, sets scheduled_for, sets status "To Start", sets recurring_template_id
  - `generateUpcoming(templateId, daysAhead: number)` — generates all instances not yet created up to daysAhead from now
- `app/api/cron/recurring/route.ts`
  - Secured by CRON_SECRET
  - For every task with recurring_rule.mode = "schedule": call generateUpcoming(id, advance_days)
- `src/components/RecurringRuleBuilder.tsx`
  - UI component rendered inside TaskForm "Advanced Options"
  - Mode selector (after completion / on schedule)
  - Pattern builder: type dropdown → conditional fields (days of week checkboxes, day-of-month picker, nth weekday selectors, interval input, cron string input)
  - Preview: "Next occurrence: Wed 1 Apr 2026"

### Changed files
- `app/api/tasks/[id]/route.ts` PATCH
  - If status changes to "Completed" and task has recurring_rule.mode = "after_completion":
    - Call generateInstance(task, getNextOccurrence(rule, now))
    - Create the new task in DB
    - Schedule notification for new task if applicable
- `src/components/TaskForm.tsx`
  - Render `<RecurringRuleBuilder>` under "Advanced Options"
- `src/components/TaskTable.tsx`
  - Show recurring indicator icon (↻) on tasks with recurring_rule
  - Show "· Mon 23 Mar" label styling for instances (muted, smaller)

### Title format
Template: `"Weekly Review"` → Instance title: `"Weekly Review · Mon 23 Mar"`
Use `scheduled_for` date, format as `EEE d MMM` (date-fns).

### MCP tests to add
- Create task with recurring_rule (weekly, after_completion)
- Complete task → verify new instance created with correct title + scheduled_for
- Create task with recurring_rule (schedule) → cron generates instance
- Verify advance_days respected (no instances created beyond window)

---

## Phase 4 — Badges

**Design:** Robinhood-style — celebratory moment when a milestone is hit. Confetti animation + badge card. Badges are awarded once and stored. Checked after every task completion.

### Badge catalogue

| ID | Name | Trigger |
|----|------|---------|
| `first_step` | First Step | First task completed |
| `on_a_roll` | On a Roll | 3-day streak |
| `week_warrior` | Week Warrior | 7-day streak |
| `unstoppable` | Unstoppable | 30-day streak |
| `getting_things_done` | Getting Things Done | 10 tasks completed |
| `productivity_pro` | Productivity Pro | 50 tasks completed |
| `century_club` | Century Club | 100 tasks completed |
| `legend` | Legend | 500 tasks completed |
| `speed_run` | Speed Run | 5 tasks completed in one day |
| `perfect_week` | Perfect Week | Every task due this week completed on time |

### DB migrations
None — `reminders_gamification.badges` is already a text[] array.

Add total_completed count tracking to gamification:
```sql
ALTER TABLE reminders_gamification
  ADD COLUMN total_completed INT NOT NULL DEFAULT 0;
```

### New files
- `src/lib/badge.service.ts`
  - `BADGES` — catalogue of all badge definitions with id, name, description, icon
  - `checkAndAwardBadges(userId) → string[]` — queries gamification stats, checks each badge condition, awards any not already in badges[], returns array of newly awarded badge IDs
  - Called after every task completion (from PATCH route)

### Changed files
- `src/lib/gamification.service.ts` — `awardPoints` also increments `total_completed`
- `app/api/tasks/[id]/route.ts` PATCH
  - If status changes to "Completed": call awardPoints(userId, 10), then checkAndAwardBadges(userId)
  - Return `{ task, newBadges: [...] }` in response
- `src/components/MomentumView.tsx`
  - On "Done" response: if `newBadges.length > 0`, show `<BadgeModal badges={newBadges} />`
- `src/components/TaskDashboard.tsx`
  - Same — show badge modal on task completion
- `app/(main)/dashboard/settings/page.tsx`
  - Badge history section: grid of earned badges (greyed out if not earned)

### New components
- `src/components/BadgeModal.tsx` — full-screen overlay, confetti (use `canvas-confetti` package), badge card with icon + name + description, dismiss button
- `src/components/BadgeGrid.tsx` — shows all badges, earned ones highlighted, unearned greyed with "???" name

### MCP tests to add
- Complete first task → verify `first_step` badge awarded
- Award points twice in rapid succession → verify streak badges at correct thresholds
- Query gamification record → verify total_completed increments

---

## Phase 5 — Settings Backend

**Design:** Wire up everything the Settings UI currently shows as a toggle but doesn't save. Single settings endpoint. Telegram connect. Email digest cron.

### New files
- `app/api/settings/route.ts`
  - GET — return full reminders_user_settings row (create with defaults if first visit)
  - PATCH — update any subset of settings fields
- `app/api/cron/digest/route.ts`
  - Secured by CRON_SECRET
  - For users with digest_enabled = true, digest_time matching current hour: send daily summary email (list of tasks due today + overdue)

### Changed files
- `app/(main)/dashboard/settings/page.tsx` — full rewrite from placeholder to functional:
  - On mount: GET /api/settings, populate all fields
  - Each toggle/input: optimistic update + PATCH /api/settings
  - Sections:
    - **Notifications:** default channel (email/telegram/both), default timing, cascade fallback info text
    - **Telegram:** connect instructions + chat_id input field, "Connected ✓" state once set
    - **Email digest:** on/off toggle + time-of-day picker
    - **Gamification:** leaderboard on/off, badge history (`<BadgeGrid />`)

### MCP tests to add
- GET /api/settings → returns defaults for new user
- PATCH /api/settings → verify fields updated
- Digest cron → verify email queued for eligible users

---

## Deployment notes

- All phases: rebuild Docker image after each phase
- Phase 2+: add RESEND_API_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET to `.env`
- Cron jobs (notifications + recurring + digest): register in Caddy or as system cron calling the secured endpoints:
  ```
  */5 * * * *  curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3024/api/cron/notifications
  0   2 * * *  curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3024/api/cron/recurring
  0   * * * *  curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3024/api/cron/digest
  ```
- DB migrations: run via `docker exec 24reminders npx tsx scripts/migrate.ts` or direct psql

---

## MCP test suite expansion target

After all phases: **~70 tests** (up from 41).

| Phase | New tests | Running total |
|-------|-----------|---------------|
| Current | — | 41 |
| Phase 1 | +8 | 49 |
| Phase 2 | +10 | 59 |
| Phase 3 | +6 | 65 |
| Phase 4 | +4 | 69 |
| Phase 5 | +4 | 73 |
