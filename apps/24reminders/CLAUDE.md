# Original Vision for 24reminders — Reference Spec

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
