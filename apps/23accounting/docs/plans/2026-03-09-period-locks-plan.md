# Period Locks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent posting into closed accounting periods, with per-user override grants and correcting-transaction interception for attempted edits.

**Architecture:** High-water mark (`locked_through_date` on `entities`) enforced in every write API route via a central `period_lock.service.ts`. Per-user overrides in a `period_overrides` table. VAT submission auto-locks its period. Frontend shows inline date correction and a correcting-transaction modal for edits/deletes in locked periods.

**Tech Stack:** Next.js 14 App Router, PostgreSQL (via `lib/db.ts` `query()`), TypeScript, Tailwind CSS, existing component patterns from `SettingsForm.tsx`

**Design doc:** `docs/plans/2026-03-09-period-locks-design.md`

**Run migrations with:**
```bash
docker exec relentify-accounts npx ts-node --project tsconfig.json scripts/<script>.ts
```

**Build check:**
```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -30
```

---

## Task 1: DB Migration — Add lock columns and tables

**Files:**
- Create: `scripts/migration-017-period-locks.sql`
- Create: `scripts/run-migration-017.ts`

**Step 1: Write the SQL migration**

Create `scripts/migration-017-period-locks.sql`:

```sql
-- Migration 017: Period locks

-- Add lock boundary to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS locked_through_date DATE NULL;

-- Audit trail of every lock boundary change
CREATE TABLE IF NOT EXISTS period_lock_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  locked_by     UUID NOT NULL REFERENCES users(id),
  lock_type     TEXT NOT NULL CHECK (lock_type IN ('vat_filing', 'manual_year_end', 'unlock')),
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  reason        TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_period_lock_events_entity ON period_lock_events(entity_id);

-- Per-user posting override (admin/accountant grants named user access to locked period)
CREATE TABLE IF NOT EXISTS period_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by      UUID NOT NULL REFERENCES users(id),
  override_until  TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_period_overrides_entity ON period_overrides(entity_id);
CREATE INDEX IF NOT EXISTS idx_period_overrides_user ON period_overrides(entity_id, user_id);
```

**Step 2: Write the runner script**

Create `scripts/run-migration-017.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../lib/db';

async function run() {
  console.log('=== Migration 017: Period Locks ===\n');
  const sql = fs.readFileSync(path.join(__dirname, 'migration-017-period-locks.sql'), 'utf8');
  await query(sql);
  console.log('Migration 017 complete.');
  process.exit(0);
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
```

**Step 3: Run the migration**

```bash
docker exec relentify-accounts npx ts-node --project tsconfig.json scripts/run-migration-017.ts
```

Expected output:
```
=== Migration 017: Period Locks ===
Migration 017 complete.
```

**Step 4: Verify in Postgres**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d period_overrides"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d period_lock_events"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d entities" | grep locked
```

Expected: column and both tables visible.

**Step 5: Commit**

```bash
cd /opt/relentify-accounts
git add scripts/migration-017-period-locks.sql scripts/run-migration-017.ts
git commit -m "feat: migration 017 — period_lock_events and period_overrides tables"
```

---

## Task 2: `period_lock.service.ts`

**Files:**
- Create: `lib/services/period_lock.service.ts`

**Step 1: Write the service**

Create `lib/services/period_lock.service.ts`:

```typescript
import { query } from '../db';

export interface LockCheck {
  locked: boolean;
  lockedThrough: string | null;   // YYYY-MM-DD
  reason: string | null;
  earliestUnlockedDate: string;   // YYYY-MM-DD — today if not locked
}

export interface PeriodLockEvent {
  id: string;
  lock_type: 'vat_filing' | 'manual_year_end' | 'unlock';
  from_date: string;
  to_date: string;
  reason: string | null;
  locked_by_name: string;
  created_at: string;
}

export interface PeriodOverride {
  id: string;
  user_id: string;
  user_name: string;
  granted_by_name: string;
  override_until: string;
  created_at: string;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns the day after lockedThrough, or today if not locked */
function dayAfter(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatLockReason(event: { lock_type: string; created_at: string | Date }): string {
  const date = new Date(event.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  if (event.lock_type === 'vat_filing') return `VAT return filed ${date}`;
  if (event.lock_type === 'manual_year_end') return `Year-end lock applied ${date}`;
  return `Period locked ${date}`;
}

/**
 * Check whether a given date falls in a locked period for this entity+user.
 * If the user has an active override, returns locked: false.
 */
export async function isDateLocked(
  entityId: string,
  date: string,
  userId: string
): Promise<LockCheck> {
  // Check user override first
  const overrideRes = await query(
    `SELECT 1 FROM period_overrides
     WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
    [entityId, userId]
  );
  if (overrideRes.rows.length > 0) {
    return { locked: false, lockedThrough: null, reason: null, earliestUnlockedDate: today() };
  }

  // Get entity lock boundary
  const entityRes = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`,
    [entityId]
  );
  const lockedThrough: string | null = entityRes.rows[0]?.locked_through_date
    ? new Date(entityRes.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  if (!lockedThrough || date > lockedThrough) {
    return { locked: false, lockedThrough, reason: null, earliestUnlockedDate: today() };
  }

  // Find the most recent lock event for a human-readable reason
  const eventRes = await query(
    `SELECT lock_type, created_at FROM period_lock_events
     WHERE entity_id=$1 AND lock_type != 'unlock'
     ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  );
  const reason = eventRes.rows[0] ? formatLockReason(eventRes.rows[0]) : 'Period is locked';

  return {
    locked: true,
    lockedThrough,
    reason,
    earliestUnlockedDate: dayAfter(lockedThrough),
  };
}

/** Returns earliest date a user can post to (respects override) */
export async function getEarliestUnlockedDate(entityId: string, userId?: string): Promise<string> {
  if (userId) {
    const overrideRes = await query(
      `SELECT 1 FROM period_overrides
       WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
      [entityId, userId]
    );
    if (overrideRes.rows.length > 0) return today();
  }

  const res = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`,
    [entityId]
  );
  const lockedThrough: string | null = res.rows[0]?.locked_through_date
    ? new Date(res.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  return lockedThrough ? dayAfter(lockedThrough) : today();
}

/**
 * Lock a period. Advances locked_through_date if toDate is later than current value.
 * Always records a lock event.
 */
export async function lockPeriod(
  entityId: string,
  userId: string,
  lockType: 'vat_filing' | 'manual_year_end',
  fromDate: string,
  toDate: string,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE entities
     SET locked_through_date = GREATEST(locked_through_date, $1::date), updated_at = NOW()
     WHERE id=$2`,
    [toDate, entityId]
  );
  await query(
    `INSERT INTO period_lock_events (entity_id, locked_by, lock_type, from_date, to_date, reason)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [entityId, userId, lockType, fromDate, toDate, reason || null]
  );
}

/** Remove lock entirely. Records an unlock event. */
export async function unlockPeriod(entityId: string, userId: string): Promise<void> {
  const res = await query(`SELECT locked_through_date FROM entities WHERE id=$1`, [entityId]);
  const current = res.rows[0]?.locked_through_date;
  if (!current) return; // nothing to unlock

  await query(
    `UPDATE entities SET locked_through_date = NULL, updated_at = NOW() WHERE id=$1`,
    [entityId]
  );
  await query(
    `INSERT INTO period_lock_events (entity_id, locked_by, lock_type, from_date, to_date, reason)
     VALUES ($1,$2,'unlock',$3,$3,'Manual unlock')`,
    [entityId, userId, new Date(current).toISOString().split('T')[0]]
  );
}

export async function getLockHistory(entityId: string): Promise<PeriodLockEvent[]> {
  const res = await query(
    `SELECT ple.id, ple.lock_type, ple.from_date, ple.to_date, ple.reason, ple.created_at,
            COALESCE(u.full_name, u.email) as locked_by_name
     FROM period_lock_events ple
     JOIN users u ON ple.locked_by = u.id
     WHERE ple.entity_id=$1
     ORDER BY ple.created_at DESC`,
    [entityId]
  );
  return res.rows;
}

/** Grant a named user posting access into locked periods until a given time */
export async function grantOverride(
  entityId: string,
  userId: string,
  grantedBy: string,
  overrideUntil: Date
): Promise<void> {
  await query(
    `INSERT INTO period_overrides (entity_id, user_id, granted_by, override_until)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (entity_id, user_id)
     DO UPDATE SET granted_by=$3, override_until=$4, created_at=NOW()`,
    [entityId, userId, grantedBy, overrideUntil.toISOString()]
  );
}

export async function revokeOverride(entityId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM period_overrides WHERE entity_id=$1 AND user_id=$2`,
    [entityId, userId]
  );
}

export async function getActiveOverrides(entityId: string): Promise<PeriodOverride[]> {
  const res = await query(
    `SELECT po.id, po.user_id, po.override_until, po.created_at,
            COALESCE(u.full_name, u.email) as user_name,
            COALESCE(g.full_name, g.email) as granted_by_name
     FROM period_overrides po
     JOIN users u ON po.user_id = u.id
     JOIN users g ON po.granted_by = g.id
     WHERE po.entity_id=$1 AND po.override_until > NOW()
     ORDER BY po.created_at DESC`,
    [entityId]
  );
  return res.rows;
}

export async function hasOverride(entityId: string, userId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM period_overrides
     WHERE entity_id=$1 AND user_id=$2 AND override_until > NOW()`,
    [entityId, userId]
  );
  return res.rows.length > 0;
}
```

**Step 2: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

Expected: no TypeScript errors.

**Step 3: Commit**

```bash
git add lib/services/period_lock.service.ts
git commit -m "feat: add period_lock.service.ts"
```

---

## Task 3: Period Locks API Routes

**Files:**
- Create: `app/api/period-locks/route.ts`
- Create: `app/api/period-locks/earliest-open/route.ts`
- Create: `app/api/period-locks/overrides/route.ts`
- Create: `app/api/period-locks/overrides/[userId]/route.ts`

**Step 1: Main period-locks route (status, history, manual lock)**

Create `app/api/period-locks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import {
  getLockHistory,
  lockPeriod,
  unlockPeriod,
} from '@/lib/services/period_lock.service';
import { query } from '@/lib/db';

function canManageLocks(tier: string | null | undefined, isOwner: boolean): boolean {
  return isOwner || tier === 'accountant';
}

export async function GET(_req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entityRes = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`, [entity.id]
  );
  const lockedThrough = entityRes.rows[0]?.locked_through_date
    ? new Date(entityRes.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  const history = await getLockHistory(entity.id);
  return NextResponse.json({ lockedThrough, history });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, fromDate, toDate, reason } = await req.json();

  if (action === 'lock') {
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'fromDate and toDate required' }, { status: 400 });
    }
    await lockPeriod(entity.id, auth.userId, 'manual_year_end', fromDate, toDate, reason);
    return NextResponse.json({ success: true });
  }

  if (action === 'unlock') {
    await unlockPeriod(entity.id, auth.userId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

**Step 2: Earliest open date route**

Create `app/api/period-locks/earliest-open/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getEarliestUnlockedDate } from '@/lib/services/period_lock.service';

export async function GET(_req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ date: new Date().toISOString().split('T')[0] });

  const date = await getEarliestUnlockedDate(entity.id, auth.userId);
  return NextResponse.json({ date });
}
```

**Step 3: Overrides list + grant**

Create `app/api/period-locks/overrides/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { getActiveOverrides, grantOverride } from '@/lib/services/period_lock.service';

function canManageLocks(tier: string | null | undefined, isOwner: boolean): boolean {
  return isOwner || tier === 'accountant';
}

export async function GET(_req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const overrides = await getActiveOverrides(entity.id);
  return NextResponse.json({ overrides });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, overrideUntil } = await req.json();
  if (!userId || !overrideUntil) {
    return NextResponse.json({ error: 'userId and overrideUntil required' }, { status: 400 });
  }

  const until = new Date(overrideUntil);
  if (isNaN(until.getTime()) || until <= new Date()) {
    return NextResponse.json({ error: 'overrideUntil must be a future datetime' }, { status: 400 });
  }

  await grantOverride(entity.id, userId, auth.userId, until);
  return NextResponse.json({ success: true });
}
```

**Step 4: Revoke override**

Create `app/api/period-locks/overrides/[userId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { revokeOverride } from '@/lib/services/period_lock.service';

function canManageLocks(tier: string | null | undefined, isOwner: boolean): boolean {
  return isOwner || tier === 'accountant';
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = await params;
  await revokeOverride(entity.id, userId);
  return NextResponse.json({ success: true });
}
```

**Step 5: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add app/api/period-locks/
git commit -m "feat: period-locks API routes (status, history, earliest-open, overrides)"
```

---

## Task 4: VAT Auto-Lock on Submission

**Files:**
- Modify: `app/api/hmrc/vat/submit/route.ts`

**Step 1: Read the current file**

Already read above. The `POST` handler calls `submitVatReturn` and returns the result.

**Step 2: Add the auto-lock call after successful submission**

Edit `app/api/hmrc/vat/submit/route.ts` — add import and lock call:

```typescript
import { lockPeriod } from '@/lib/services/period_lock.service';

// Inside the try block, after submitVatReturn succeeds:
const result = await submitVatReturn(user.vat_number, token, req, auth.userId, periodKey, boxes);

// Auto-lock the filed period
try {
  await lockPeriod(entity.id, auth.userId, 'vat_filing', from, to,
    `VAT return submitted for period ${from} to ${to}`);
} catch (lockErr) {
  console.error('Failed to auto-lock period after VAT submission:', lockErr);
  // Non-blocking — submission already succeeded
}

return NextResponse.json({ success: true, ...result });
```

**Step 3: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add app/api/hmrc/vat/submit/route.ts
git commit -m "feat: auto-lock VAT period on successful HMRC submission"
```

---

## Task 5: Enforce Lock on All Write Routes

This task adds the lock check to every route that creates or edits a transaction. The pattern is identical each time — add three lines after `getActiveEntity`:

```typescript
import { isDateLocked } from '@/lib/services/period_lock.service';

// After entity resolution, before the write:
const lockCheck = await isDateLocked(entity.id, <dateField>, auth.userId);
if (lockCheck.locked) {
  return NextResponse.json({
    error: 'PERIOD_LOCKED',
    lockedThrough: lockCheck.lockedThrough,
    reason: lockCheck.reason,
    earliestUnlockedDate: lockCheck.earliestUnlockedDate,
  }, { status: 403 });
}
```

Apply this to each route listed below. The date field to check is noted per route.

**Routes and date fields:**

| File | Handler | Date field in body |
|---|---|---|
| `app/api/invoices/route.ts` | POST | `body.issueDate \|\| today` |
| `app/api/invoices/[id]/route.ts` | PATCH | `body.issueDate` (if present) |
| `app/api/invoices/[id]/route.ts` | DELETE | `inv.issue_date` (the existing record's date) |
| `app/api/invoices/[id]/pay/route.ts` | POST | `body.paymentDate \|\| today` |
| `app/api/bills/route.ts` | POST | `body.invoiceDate \|\| body.dueDate` |
| `app/api/bills/[id]/route.ts` | PATCH | `body.invoiceDate \|\| body.dueDate` |
| `app/api/bills/[id]/route.ts` | DELETE | existing bill's `invoice_date \|\| due_date` |
| `app/api/bills/[id]/pay/route.ts` | POST | `body.paymentDate \|\| today` |
| `app/api/journals/route.ts` | POST | `body.date` |
| `app/api/journals/[id]/route.ts` | DELETE | existing journal's `date` |
| `app/api/credit-notes/route.ts` | POST | `body.issueDate \|\| today` |
| `app/api/credit-notes/[id]/route.ts` | PATCH | `body.issueDate` |
| `app/api/credit-notes/[id]/route.ts` | DELETE | existing record's `issue_date` |
| `app/api/expenses/route.ts` | POST | `body.date` |
| `app/api/expenses/[id]/route.ts` | PATCH | `body.date` |
| `app/api/expenses/[id]/route.ts` | DELETE | existing record's `date` |
| `app/api/mileage/route.ts` | POST | `body.date` |
| `app/api/mileage/[id]/route.ts` | PATCH | `body.date` |
| `app/api/mileage/[id]/route.ts` | DELETE | existing record's `date` |

**Step 1: Read each file before modifying** (use Read tool on each)

**Step 2: Add enforcement to each route** (Edit tool, following the pattern above)

For DELETE routes where you need the existing record's date, fetch the record first (most routes already do this to check ownership), then use that date.

**Step 3: Build check after all routes updated**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add app/api/invoices/ app/api/bills/ app/api/journals/ app/api/credit-notes/ app/api/expenses/ app/api/mileage/
git commit -m "feat: enforce period lock on all write routes"
```

---

## Task 6: Settings UI — Period Locks Section

**Files:**
- Modify: `app/dashboard/settings/SettingsForm.tsx`

The settings page already uses tabs (`activeTab` state). Add a `'period-locks'` tab. This section is only shown to entity owners and accountant-tier users — pass `isOwner` and `tier` as props to `SettingsForm`, or fetch them inside.

**Step 1: Read the full SettingsForm.tsx**

```bash
# Use Read tool on app/dashboard/settings/SettingsForm.tsx
```

**Step 2: Add a `PeriodLocksTab` component inline in the file**

Add below all existing state declarations, before the return:

```typescript
// --- Period Locks state ---
const [lockData, setLockData] = useState<{
  lockedThrough: string | null;
  history: Array<{ id: string; lock_type: string; from_date: string; to_date: string; reason: string | null; locked_by_name: string; created_at: string }>;
} | null>(null);
const [overrides, setOverrides] = useState<Array<{
  id: string; user_id: string; user_name: string; granted_by_name: string; override_until: string;
}>>([]);
const [lockLoading, setLockLoading] = useState(false);
const [lockError, setLockError] = useState('');
const [manualLockModal, setManualLockModal] = useState(false);
const [manualLockFrom, setManualLockFrom] = useState('');
const [manualLockTo, setManualLockTo] = useState('');
const [manualLockReason, setManualLockReason] = useState('');
const [grantModal, setGrantModal] = useState(false);
const [grantUserId, setGrantUserId] = useState('');
const [grantUntil, setGrantUntil] = useState('');
const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);

async function loadLockData() {
  const [lockRes, overrideRes] = await Promise.all([
    fetch('/api/period-locks'),
    fetch('/api/period-locks/overrides'),
  ]);
  if (lockRes.ok) setLockData(await lockRes.json());
  if (overrideRes.ok) {
    const d = await overrideRes.json();
    setOverrides(d.overrides || []);
  }
}

async function loadTeamMembers() {
  const res = await fetch('/api/team');
  if (res.ok) {
    const d = await res.json();
    setTeamMembers((d.members || []).map((m: any) => ({
      id: m.id,
      name: m.full_name || m.email,
    })));
  }
}

useEffect(() => {
  if (activeTab === 'period-locks') {
    loadLockData();
    loadTeamMembers();
  }
}, [activeTab]);

async function handleManualLock() {
  setLockLoading(true); setLockError('');
  const res = await fetch('/api/period-locks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'lock', fromDate: manualLockFrom, toDate: manualLockTo, reason: manualLockReason }),
  });
  setLockLoading(false);
  if (!res.ok) { setLockError('Failed to lock period'); return; }
  setManualLockModal(false);
  await loadLockData();
}

async function handleUnlock() {
  if (!confirm('Remove the period lock for all users? You can re-lock at any time.')) return;
  setLockLoading(true);
  await fetch('/api/period-locks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unlock' }),
  });
  setLockLoading(false);
  await loadLockData();
}

async function handleGrantOverride() {
  setLockLoading(true); setLockError('');
  const res = await fetch('/api/period-locks/overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: grantUserId, overrideUntil: grantUntil }),
  });
  setLockLoading(false);
  if (!res.ok) { setLockError('Failed to grant override'); return; }
  setGrantModal(false);
  await loadLockData();
}

async function handleRevokeOverride(userId: string, userName: string) {
  if (!confirm(`Revoke posting access for ${userName}?`)) return;
  await fetch(`/api/period-locks/overrides/${userId}`, { method: 'DELETE' });
  await loadLockData();
}
```

**Step 3: Add the tab button**

Find the tab buttons section and add:

```tsx
<button
  onClick={() => setActiveTab('period-locks')}
  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
    activeTab === 'period-locks'
      ? 'bg-emerald-600 text-white'
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
  }`}
>
  Period Locks
</button>
```

**Step 4: Add the tab content panel**

Add this block alongside the other `activeTab === '...'` sections:

```tsx
{activeTab === 'period-locks' && (
  <div className="space-y-8">
    {/* Lock status */}
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-white/[0.07]">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Lock Status</h3>
      {lockData ? (
        <div className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
            lockData.lockedThrough
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          }`}>
            {lockData.lockedThrough
              ? `Locked through ${new Date(lockData.lockedThrough).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'No periods locked'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setManualLockModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Lock a period
            </button>
            {lockData.lockedThrough && (
              <button
                onClick={handleUnlock}
                disabled={lockLoading}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Remove lock
              </button>
            )}
          </div>

          {/* Lock history */}
          {lockData.history.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">History</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.07]">
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 font-medium">By</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {lockData.history.map(e => (
                      <tr key={e.id} className="text-slate-700 dark:text-slate-300">
                        <td className="py-2 capitalize">{e.lock_type.replace('_', ' ')}</td>
                        <td className="py-2">{e.from_date} → {e.to_date}</td>
                        <td className="py-2">{e.locked_by_name}</td>
                        <td className="py-2">{new Date(e.created_at).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading...</p>
      )}
    </div>

    {/* Override grants */}
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-white/[0.07]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Posting Overrides</h3>
        <button
          onClick={() => setGrantModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Grant access
        </button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Grant a team member temporary access to post into locked periods. The lock remains in place for all other users.
      </p>
      {overrides.length === 0 ? (
        <p className="text-sm text-slate-400">No active overrides.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.07]">
              <th className="pb-2 font-medium">User</th>
              <th className="pb-2 font-medium">Granted by</th>
              <th className="pb-2 font-medium">Expires</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {overrides.map(o => (
              <tr key={o.id} className="text-slate-700 dark:text-slate-300">
                <td className="py-2">{o.user_name}</td>
                <td className="py-2">{o.granted_by_name}</td>
                <td className="py-2">{new Date(o.override_until).toLocaleString('en-GB')}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleRevokeOverride(o.user_id, o.user_name)}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {lockError && <p className="text-sm text-red-500">{lockError}</p>}

    {/* Manual lock modal */}
    {manualLockModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Lock a period</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From date</label>
              <input type="date" value={manualLockFrom} onChange={e => setManualLockFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lock through (to date)</label>
              <input type="date" value={manualLockTo} onChange={e => setManualLockTo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason (optional)</label>
              <input type="text" placeholder="e.g. Year-end 2024" value={manualLockReason} onChange={e => setManualLockReason(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleManualLock} disabled={lockLoading || !manualLockFrom || !manualLockTo}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl">
              Lock period
            </button>
            <button onClick={() => setManualLockModal(false)}
              className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Grant override modal */}
    {grantModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Grant posting access</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            This person will be able to post into the locked period until the time you set. Everyone else remains locked out.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team member</label>
              <select value={grantUserId} onChange={e => setGrantUserId(e.target.value)} className={inputCls}>
                <option value="">Select a person...</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allow posting until</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { label: '2 hours', hours: 2 },
                  { label: '8 hours', hours: 8 },
                  { label: '24 hours', hours: 24 },
                  { label: 'End of day', hours: null },
                ].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      if (opt.hours === null) {
                        const eod = new Date();
                        eod.setHours(23, 59, 59, 0);
                        setGrantUntil(eod.toISOString().slice(0, 16));
                      } else {
                        const t = new Date(Date.now() + opt.hours * 3600 * 1000);
                        setGrantUntil(t.toISOString().slice(0, 16));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input type="datetime-local" value={grantUntil} onChange={e => setGrantUntil(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleGrantOverride} disabled={lockLoading || !grantUserId || !grantUntil}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl">
              Grant access
            </button>
            <button onClick={() => setGrantModal(false)}
              className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

**Step 5: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add app/dashboard/settings/SettingsForm.tsx
git commit -m "feat: add Period Locks tab to settings page"
```

---

## Task 7: Frontend — `usePeriodLock` Hook and Inline Date Warning

**Files:**
- Create: `lib/hooks/usePeriodLock.ts`

This hook fetches the earliest open date and provides a helper to check if a given date is before it. Used by all date pickers across the app.

**Step 1: Write the hook**

Create `lib/hooks/usePeriodLock.ts`:

```typescript
'use client';
import { useEffect, useState, useCallback } from 'react';

interface PeriodLockState {
  earliestOpenDate: string | null;   // YYYY-MM-DD, null while loading
  isDateLocked: (date: string) => boolean;
  lockedMessage: (date: string) => string | null;
}

export function usePeriodLock(): PeriodLockState {
  const [earliestOpenDate, setEarliestOpenDate] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/period-locks/earliest-open')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.date) setEarliestOpenDate(d.date); })
      .catch(() => {});
  }, []);

  const isDateLocked = useCallback((date: string): boolean => {
    if (!earliestOpenDate || !date) return false;
    return date < earliestOpenDate;
  }, [earliestOpenDate]);

  const lockedMessage = useCallback((date: string): string | null => {
    if (!earliestOpenDate || !date) return null;
    if (date < earliestOpenDate) {
      const formatted = new Date(earliestOpenDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      return `This period is locked — date moved to ${formatted}`;
    }
    return null;
  }, [earliestOpenDate]);

  return { earliestOpenDate, isDateLocked, lockedMessage };
}
```

**Step 2: Apply to a date input — pattern to use on every form with a date field**

On any form where a user picks a date, import the hook and add:

```tsx
const { earliestOpenDate, isDateLocked, lockedMessage } = usePeriodLock();

// When rendering the date input:
<div>
  <input
    type="date"
    value={dateValue}
    min={earliestOpenDate || undefined}
    onChange={e => {
      const val = e.target.value;
      // Auto-correct to earliest open date if user picks a locked date
      setDateValue(isDateLocked(val) ? (earliestOpenDate || val) : val);
    }}
    className={inputCls}
  />
  {lockedMessage(dateValue) && (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
      {lockedMessage(dateValue)}
    </p>
  )}
</div>
```

Apply this pattern to the key create forms:
- New invoice form (`app/dashboard/invoices/new/` or wherever the invoice create form lives)
- New bill form
- New journal form
- New expense form
- New mileage form

Read each form file first, then apply the pattern to its date field.

**Step 3: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add lib/hooks/usePeriodLock.ts
git commit -m "feat: usePeriodLock hook for inline date field correction"
```

---

## Task 8: Frontend — Period Locked Modal (Correcting Transactions)

**Files:**
- Create: `components/PeriodLockedModal.tsx`

This component is shown when any API call returns `PERIOD_LOCKED`. It explains what correcting transaction will be created and on confirm, fires the appropriate API call.

**Step 1: Write the modal**

Create `components/PeriodLockedModal.tsx`:

```tsx
'use client';
import { useState } from 'react';

export type CorrectingEntry = {
  description: string;     // e.g. "a credit note for £25"
  explanation: string;     // e.g. "This reduces the invoice from £100 to £75..."
  onConfirm: () => Promise<void>;
};

interface Props {
  lockedThrough: string;
  reason: string | null;
  earliestUnlockedDate: string;
  correctingEntry: CorrectingEntry | null;   // null = no automatic correction available
  onClose: () => void;
}

export default function PeriodLockedModal({
  lockedThrough,
  reason,
  earliestUnlockedDate,
  correctingEntry,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formattedLocked = new Date(lockedThrough).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedOpen = new Date(earliestUnlockedDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleConfirm() {
    if (!correctingEntry) return;
    setLoading(true); setError('');
    try {
      await correctingEntry.onConfirm();
      onClose();
    } catch {
      setError('Failed to create correcting entry. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2h2m-2 0H10" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">This period is locked</h3>
            {reason && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{reason}</p>}
          </div>
        </div>

        {/* Explanation */}
        {correctingEntry ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              <strong>Here's what we'll do instead:</strong>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              We'll create <strong>{correctingEntry.description}</strong> dated{' '}
              <strong>{formattedOpen}</strong> — the first day of your open period.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {correctingEntry.explanation} This keeps your locked period ({formattedLocked}) unchanged.
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Transactions in locked periods cannot be edited directly. Please contact your accountant to post a correcting entry, or ask them to grant you temporary posting access.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          {correctingEntry && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Creating...' : 'Confirm'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Write a helper to parse PERIOD_LOCKED responses**

Add to `lib/period-lock-helpers.ts`:

```typescript
export interface PeriodLockedError {
  lockedThrough: string;
  reason: string | null;
  earliestUnlockedDate: string;
}

export async function parsePeriodLockedResponse(res: Response): Promise<PeriodLockedError | null> {
  if (res.status !== 403) return null;
  try {
    const body = await res.clone().json();
    if (body.error === 'PERIOD_LOCKED') {
      return {
        lockedThrough: body.lockedThrough,
        reason: body.reason,
        earliestUnlockedDate: body.earliestUnlockedDate,
      };
    }
  } catch {}
  return null;
}
```

**Step 3: Wire up to key pages**

For each page that has edit/delete actions (invoices detail, bills detail, expenses, mileage, journals), add:

1. State: `const [periodLockedError, setPeriodLockedError] = useState<PeriodLockedError | null>(null)`
2. After any mutating fetch call: `const locked = await parsePeriodLockedResponse(res); if (locked) { setPeriodLockedError(locked); return; }`
3. Render `PeriodLockedModal` when `periodLockedError` is set, with a `correctingEntry` appropriate to that record type (see design doc table)

**The correcting entry `onConfirm` for invoices (reduce):**
```typescript
onConfirm: async () => {
  await fetch('/api/credit-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // customerId, amount = difference, issueDate = earliestUnlockedDate
      // linked to the original invoice
    }),
  });
}
```

Follow the same pattern for bills (create a negative bill), expenses (negative expense), mileage (negative mileage entry), journals (call the existing reverse endpoint).

**Step 4: Build check**

```bash
docker compose -f /opt/relentify-accounts/docker-compose.yml build --no-cache 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add components/PeriodLockedModal.tsx lib/period-lock-helpers.ts
git commit -m "feat: PeriodLockedModal and correcting transaction pattern"
```

---

## Task 9: Final Integration Check

**Step 1: Rebuild and deploy**

```bash
cd /opt/relentify-accounts
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs relentify-accounts --tail 50 -f
```

**Step 2: Manual smoke tests**

1. **Create a lock:** Go to Settings → Period Locks → Lock a period (e.g. 1 Jan 2024 to 31 Mar 2024)
2. **Verify inline block:** Try to create an invoice dated 15 Jan 2024 — date field should auto-correct to 1 Apr 2024 with inline message
3. **Verify API block:** POST directly to `/api/invoices` with `issueDate: "2024-01-15"` — expect 403 `PERIOD_LOCKED` response
4. **Grant override:** Settings → Period Locks → Grant access → pick yourself → 2 hours → confirm
5. **Verify override works:** Same POST with your user session — expect 201 success
6. **Revoke override:** Settings → Period Locks → Revoke → verify POST is blocked again
7. **VAT auto-lock:** Submit a VAT return (sandbox) — check `period_lock_events` table has a `vat_filing` row

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "SELECT * FROM period_lock_events ORDER BY created_at DESC LIMIT 5;"
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "SELECT id, locked_through_date FROM entities WHERE locked_through_date IS NOT NULL;"
```

**Step 3: Cleanup**

```bash
docker builder prune -f
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: period locks complete — enforcement, settings UI, correcting transactions (#17 #18)"
```

**Step 5: Update CLAUDE.md**

Mark items #17 and #18 as ✅ in `/opt/relentify-accounts/CLAUDE.md`.
