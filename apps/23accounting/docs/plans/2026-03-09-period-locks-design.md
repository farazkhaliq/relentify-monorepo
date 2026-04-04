# Period Locks & VAT Period Blocking — Design

**Date:** 2026-03-09
**Covers:** Checklist items #17 (Lock periods) and #18 (Block posting into previous VAT period)
**Status:** Approved, ready for implementation

---

## Overview

Prevent users from creating or editing transactions dated in a closed accounting period. Periods are locked automatically on VAT filing and manually for year-end. Admins and accountants can grant per-user posting overrides without removing the lock for everyone. Every attempted edit in a locked period is handled by offering a correcting transaction in the open period — nothing is a dead end.

---

## Approach

**Option C selected:** High-water mark + lock history.

- `locked_through_date` on `entities` — single date comparison for enforcement (fast, simple)
- `period_lock_events` table — full audit trail of every change to the boundary
- `period_overrides` table — per-user, time-limited posting rights into locked periods
- No "full unlock" concept — overrides ARE the unlock mechanism

---

## Data Model

### Migration: two columns on `entities`

```sql
ALTER TABLE entities ADD COLUMN locked_through_date DATE NULL;
-- accountant_override_until removed — replaced by period_overrides table
```

### New table: `period_lock_events`

```sql
CREATE TABLE period_lock_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  locked_by     UUID NOT NULL REFERENCES users(id),
  lock_type     TEXT NOT NULL CHECK (lock_type IN ('vat_filing', 'manual_year_end', 'unlock')),
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,   -- the locked_through_date value set at this point
  reason        TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### New table: `period_overrides`

```sql
CREATE TABLE period_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by      UUID NOT NULL REFERENCES users(id),
  override_until  TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, user_id)   -- one active override per user per entity
);
```

---

## Service Layer

### `lib/services/period_lock.service.ts` (new)

```ts
isDateLocked(entityId, date, userId): Promise<{
  locked: boolean
  lockedThrough: string | null   // YYYY-MM-DD
  reason: string | null          // e.g. "VAT return filed 14 Jan 2025"
  earliestUnlockedDate: string   // YYYY-MM-DD, defaults to today if nothing locked
}>

getEarliestUnlockedDate(entityId): Promise<string>

lockPeriod(entityId, userId, lockType, fromDate, toDate, reason?): Promise<void>
// Sets locked_through_date = MAX(current, toDate), records period_lock_event

getLockHistory(entityId): Promise<PeriodLockEvent[]>

grantOverride(entityId, userId, grantedBy, until): Promise<void>
revokeOverride(entityId, userId): Promise<void>
getActiveOverrides(entityId): Promise<PeriodOverride[]>
hasOverride(entityId, userId): Promise<boolean>
```

### Enforcement pattern (every write route)

```ts
const lockCheck = await isDateLocked(entity.id, dateField, auth.userId)
if (lockCheck.locked) {
  return NextResponse.json({
    error: 'PERIOD_LOCKED',
    lockedThrough: lockCheck.lockedThrough,
    reason: lockCheck.reason,
    earliestUnlockedDate: lockCheck.earliestUnlockedDate,
  }, { status: 403 })
}
```

`isDateLocked` internally checks `period_overrides` first — if the user has an active override, returns `locked: false` immediately.

---

## API Routes Requiring Enforcement

Every route that accepts a user-supplied date:

| Route | Date field |
|---|---|
| `POST /api/invoices` | `issue_date` |
| `PUT /api/invoices/[id]` | `issue_date` |
| `POST /api/bills` | `invoice_date` \| `due_date` |
| `PUT /api/bills/[id]` | `invoice_date` \| `due_date` |
| `POST /api/journals` | `date` |
| `PUT /api/journals/[id]` | `date` |
| `POST /api/credit-notes` | `issue_date` |
| `PUT /api/credit-notes/[id]` | `issue_date` |
| `POST /api/expenses` | `date` |
| `PUT /api/expenses/[id]` | `date` |
| `POST /api/mileage` | `date` |
| `PUT /api/mileage/[id]` | `date` |
| `POST /api/invoices/[id]/pay` | `payment_date` |
| `POST /api/bills/[id]/pay` | `payment_date` |

### VAT auto-lock

`POST /api/hmrc/vat/submit` calls `lockPeriod(entityId, userId, 'vat_filing', from, to)` on successful HMRC submission.

---

## Error Response Shape

```json
{
  "error": "PERIOD_LOCKED",
  "lockedThrough": "2024-03-31",
  "reason": "VAT return filed 14 Jan 2025",
  "earliestUnlockedDate": "2024-04-01"
}
```

---

## Frontend: Date Field Behaviour (Creation Forms)

When a user selects a date that falls in a locked period on any create/edit form:
- The date field shows an inline warning: `"This period is locked — date moved to 1 Apr 2024"`
- The date is silently corrected to `earliestUnlockedDate`
- No modal required — just inline field feedback

A helper hook `useEarliestUnlockedDate(entityId)` fetches `GET /api/period-locks/earliest-open` on mount and is used by all date pickers.

---

## Frontend: Edit Interception (Correcting Transactions)

When the API returns `PERIOD_LOCKED` on an edit or delete attempt, the frontend shows a modal explaining the correcting transaction it will create instead.

### Correcting transaction by record & action

| Record | Action wanted | Correcting entry |
|---|---|---|
| Sales invoice | Reduce amount | Credit note for the difference |
| Sales invoice | Increase amount | New invoice for the difference |
| Sales invoice | Delete | Full credit note for the total |
| Bill | Reduce amount | Purchase credit note for the difference |
| Bill | Increase amount | New bill for the difference |
| Bill | Delete | Full purchase credit note |
| Expense | Reduce / delete | Negative expense for the difference |
| Expense | Increase | Additional expense for the difference |
| Mileage | Reduce / delete | Negative mileage entry for the difference |
| Mileage | Increase | Additional mileage entry for the difference |
| Journal entry | Edit | Reversing journal + new corrected journal |
| Journal entry | Delete | Full reversing journal |
| Credit note | Edit / delete | Reversing entry for the difference |

All correcting entries are dated `earliestUnlockedDate`.

### Modal message pattern

> **This period is locked** (VAT return filed 14 Jan 2025)
>
> You can't edit this directly. Here's what we'll do instead:
>
> We'll create a **[correcting entry type] for [amount]** dated **[earliestUnlockedDate]** — the first day of your open period. This [explanation of outcome], without touching your filed VAT period.
>
> [Confirm] [Cancel]

---

## Settings UI

**Location:** `/dashboard/settings` — new "Period Locks" tab/section
**Visible to:** entity owner and accountant tier only

### Lock status panel
- Current boundary: `"Locked through 31 Mar 2024"` or `"No periods locked"`
- Lock history table: date, type (VAT filing / Manual year-end), locked by, period covered, reason
- **Manual year-end lock** button — date picker + optional reason field

### Active overrides panel
- Table: team member name, granted by, expires
- **Grant override** button → modal:
  - Pick team member (dropdown of entity users)
  - Allow posting until: 2h / 8h / 24h / end of day / custom datetime
  - [Confirm]
- **Revoke** button per row (immediate)

### New API routes
- `GET /api/period-locks` — lock status + history for entity
- `POST /api/period-locks` — create manual year-end lock
- `GET /api/period-locks/earliest-open` — returns `{ date: "YYYY-MM-DD" }`
- `GET /api/period-locks/overrides` — active overrides for entity
- `POST /api/period-locks/overrides` — grant override
- `DELETE /api/period-locks/overrides/[userId]` — revoke override

---

## Who Can Do What

| Action | Entity owner | Accountant tier | Team member |
|---|---|---|---|
| View lock status | ✅ | ✅ | ❌ |
| Manual year-end lock | ✅ | ✅ | ❌ |
| Grant override | ✅ | ✅ | ❌ |
| Revoke override | ✅ | ✅ | ❌ |
| Receive override | ✅ | ✅ | ✅ |
| Post into locked period (with override) | ✅ | ✅ | ✅ |

---

## Tier Gating

Period Locks settings section visible to `sole_trader` and above. The `invoicing` free tier has no VAT filing and no year-end close, so lock management is not relevant.

---

## Implementation Order

1. DB migration (entities column + two new tables)
2. `period_lock.service.ts`
3. `GET /api/period-locks/earliest-open` (needed by forms)
4. Enforcement on all write routes
5. VAT submit auto-lock
6. Period Locks API routes (status, history, overrides)
7. Settings UI — Period Locks section
8. Frontend date field behaviour (inline correction)
9. Frontend edit interception modal + correcting transaction creation
