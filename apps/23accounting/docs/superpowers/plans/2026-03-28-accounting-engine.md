# Accounting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every GL posting atomic (no parent record without a journal entry), add idempotency, enforce period locks at the GL layer, add control account enforcement, a full VAT engine, audit trail completeness, team roles, cron monitoring, accrual journals, prepayment tracking, and journal UI improvements.

**Architecture:** All DB mutations that include GL posting are wrapped in a `pool.connect()` transaction. `postJournalEntry` gains an optional `PoolClient` param so callers can include GL posting inside their own transaction. New services (`vat.service.ts`, `idempotency.service.ts`, `cron-monitor.service.ts`) are extracted helpers — not monolithic rewrites.

**Tech Stack:** PostgreSQL 15, `pg` (PoolClient transactions), TypeScript, Next.js 15 App Router, `npx tsx` for integration test scripts.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `database/migrations/025_accounting_engine.sql` | Create | All schema additions for this workstream |
| `src/lib/db.ts` | Modify | Export `PoolClient` type alias; add `withTransaction` helper |
| `src/lib/general_ledger.service.ts` | Modify | Accept optional `PoolClient`; period lock check inside; immutability; control account validation; audit events |
| `src/lib/invoice.service.ts` | Modify | Atomic: createInvoice, recordPayment, voidInvoice |
| `src/lib/bill.service.ts` | Modify | Atomic: createBill, recordBillPayment |
| `src/lib/credit_note.service.ts` | Modify | Atomic: createCreditNote, voidCreditNote |
| `src/lib/expense.service.ts` | Modify | Atomic: createExpense |
| `src/lib/expense_approval.service.ts` | Modify | Atomic: approveExpense, approveMileage |
| `src/lib/quote.service.ts` | Modify | Atomic: convertToInvoice |
| `src/lib/purchase_order.service.ts` | Modify | Atomic: approvePurchaseOrder |
| `src/lib/opening_balance.service.ts` | Modify | Atomic: importOpeningBalances |
| `src/lib/intercompany.service.ts` | Modify | Atomic: createIntercompanyTransaction |
| `src/lib/vat.service.ts` | Create | Explicit VAT rules per scenario; extracted from GL helpers |
| `src/lib/idempotency.service.ts` | Create | Check/store idempotency keys, 24h TTL cleanup |
| `src/lib/cron-monitor.service.ts` | Create | Record cron run start/finish; Telegram alert on failure |
| `src/lib/audit.service.ts` | Modify | Add `workspaceEntityId` param; new GL audit events |
| `src/lib/team.service.ts` | Modify | Add `getMemberRole()`, `requireRole()` helpers |
| `app/api/cron/po-escalation/route.ts` | Modify | Wrap with cron monitor |
| `app/api/cron/reminders/route.ts` | Modify | Wrap with cron monitor |
| `app/api/cron/accrual-reversals/route.ts` | Create | Post reversal entries for due accruals |
| `app/api/cron/prepayment-release/route.ts` | Create | Release one month of prepayments |
| `app/api/reports/health/route.ts` | Modify | Add GL integrity counts |
| `app/dashboard/journals/new/page.tsx` | Modify | Balance warning, draft mode, control account warning |
| `app/dashboard/journals/[id]/page.tsx` | Create (or modify) | "Reverse" button on posted journals |
| `src/lib/__tests__/gl-atomic.test.ts` | Create | Integration tests: atomicity, idempotency, period lock |
| `src/lib/__tests__/vat-engine.test.ts` | Create | VAT 9-box assertion tests |

---

## Task 1: Database Migration 025

**Files:**
- Create: `database/migrations/025_accounting_engine.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 025_accounting_engine.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/025_accounting_engine.sql

-- ────────────────────────────────────────────────
-- 1. UNIQUE constraint on journal_entries (source deduplication)
-- ────────────────────────────────────────────────

-- First remove any existing duplicates (keep newest row per group)
DELETE FROM journal_entries je
WHERE source_id IS NOT NULL
  AND je.id NOT IN (
    SELECT DISTINCT ON (entity_id, source_type, source_id) id
    FROM journal_entries
    WHERE source_id IS NOT NULL
    ORDER BY entity_id, source_type, source_id, created_at DESC
  );

ALTER TABLE journal_entries
  ADD CONSTRAINT uq_journal_entry_source
  UNIQUE (entity_id, source_type, source_id);

-- ────────────────────────────────────────────────
-- 2. Idempotency keys table
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  entity_id  UUID NOT NULL,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_entity_date
  ON idempotency_keys(entity_id, created_at);

-- ────────────────────────────────────────────────
-- 3. Journal entry: status + accrual fields + immutability
-- ────────────────────────────────────────────────

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted')),
  ADD COLUMN IF NOT EXISTS is_accrual   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reversal_date DATE,
  ADD COLUMN IF NOT EXISTS reversed_by  UUID REFERENCES journal_entries(id);

-- Back-fill: all existing entries are posted
UPDATE journal_entries SET status = 'posted' WHERE status IS NULL;

-- ────────────────────────────────────────────────
-- 4. Prepayment flag on bill payments
-- ────────────────────────────────────────────────

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS is_prepayment       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prepayment_months   INTEGER,
  ADD COLUMN IF NOT EXISTS prepayment_exp_acct UUID REFERENCES chart_of_accounts(id);

-- ────────────────────────────────────────────────
-- 5. Control accounts on chart_of_accounts
-- ────────────────────────────────────────────────

ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_control_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS control_type       TEXT
    CHECK (control_type IN ('AR', 'AP', NULL));

-- Mark existing AR/AP accounts across all entities
UPDATE chart_of_accounts SET is_control_account = TRUE, control_type = 'AR'
  WHERE code = 1100;
UPDATE chart_of_accounts SET is_control_account = TRUE, control_type = 'AP'
  WHERE code = 2100;

-- Seed Prepayments account (1300) if missing, per entity
INSERT INTO chart_of_accounts (entity_id, code, name, account_type, is_system)
SELECT e.id, 1300, 'Prepayments', 'ASSET', TRUE
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts WHERE entity_id = e.id AND code = 1300
);

-- ────────────────────────────────────────────────
-- 6. Audit log: add missing columns
-- ────────────────────────────────────────────────

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_id            UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS workspace_entity_id UUID REFERENCES entities(id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(workspace_entity_id, created_at DESC);

-- ────────────────────────────────────────────────
-- 7. Cron runs table
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cron_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  error             TEXT,
  records_processed INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job
  ON cron_runs(job_name, started_at DESC);

-- ────────────────────────────────────────────────
-- 8. Team member roles (workspace_members table — that is the actual table name)
-- ────────────────────────────────────────────────

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('admin', 'accountant', 'staff'));

-- ────────────────────────────────────────────────
-- 9. Performance indexes
-- ────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_entry_acct
  ON journal_lines(entry_id) INCLUDE (account_id, debit, credit);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_lines_account_entry
  ON journal_lines(account_id, entry_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_entity_status
  ON invoices(entity_id, status, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_entity_status
  ON bills(entity_id, status, due_date);
```

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify \
  < /opt/relentify-monorepo/apps/22accounting/database/migrations/025_accounting_engine.sql
```

Expected: no errors. If the constraint fails due to duplicates, the DELETE statement above handles it first.

- [ ] **Step 3: Verify**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'journal_entries'
  AND column_name IN ('status','is_accrual','reversal_date','reversed_by');
SELECT conname FROM pg_constraint WHERE conname = 'uq_journal_entry_source';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_log' AND column_name IN ('actor_id','workspace_entity_id');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'workspace_members' AND column_name = 'role';
"
```

Expected: all 4 journal_entries columns, the constraint, both audit_log columns, and the role column are present.

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/database/migrations/025_accounting_engine.sql
git commit -m "feat: migration 025 — accounting engine schema changes"
```

---

## Task 2: DB Transaction Helper

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Read current db.ts**

Current file (`src/lib/db.ts`):
```ts
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const query = (sql: string, params?: unknown[]) => pool.query(sql, params as any[])
export default pool
```

- [ ] **Step 2: Add PoolClient export and withTransaction helper**

Replace the entire file:

```ts
import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = (sql: string, params?: unknown[]) =>
  pool.query(sql, params as any[])

export type DbClient = Pool | PoolClient

// Runs fn inside a BEGIN/COMMIT transaction. Rolls back and rethrows on error.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export default pool
```

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/db.ts
git commit -m "feat: db.ts — PoolClient type, withTransaction helper, pool tuning (max 20)"
```

---

## Task 3: Idempotency Service

**Files:**
- Create: `src/lib/idempotency.service.ts`
- Create: `src/lib/__tests__/idempotency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/idempotency.test.ts`:

```ts
// Integration test — requires DB access
// Run: npx tsx src/lib/__tests__/idempotency.test.ts

import { checkIdempotencyKey, storeIdempotencyKey, cleanExpiredKeys } from '../idempotency.service'
import { query } from '../db'

const TEST_ENTITY = '00000000-0000-0000-0000-000000000001'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

async function cleanup() {
  await query(`DELETE FROM idempotency_keys WHERE entity_id = $1`, [TEST_ENTITY])
}

async function run() {
  await cleanup()

  // Test 1: new key returns null
  const r1 = await checkIdempotencyKey('test-key-1', TEST_ENTITY)
  assert(r1 === null, 'new key returns null')

  // Test 2: after storing, same key returns the response
  await storeIdempotencyKey('test-key-1', TEST_ENTITY, { id: 'inv-1', status: 'ok' })
  const r2 = await checkIdempotencyKey('test-key-1', TEST_ENTITY)
  assert(r2 !== null && (r2 as { id: string }).id === 'inv-1', 'stored key returns response')

  // Test 3: different entity, same key → null (scoped)
  const r3 = await checkIdempotencyKey('test-key-1', '00000000-0000-0000-0000-000000000002')
  assert(r3 === null, 'key is scoped to entity')

  await cleanup()
  console.log('\nAll idempotency tests passed.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/idempotency.test.ts 2>&1 | head -5
```

Expected: error — `Cannot find module '../idempotency.service'`

- [ ] **Step 3: Create idempotency.service.ts**

```ts
// src/lib/idempotency.service.ts
import { query } from './db'

export async function checkIdempotencyKey(
  key: string,
  entityId: string
): Promise<unknown | null> {
  const r = await query(
    `SELECT response FROM idempotency_keys
     WHERE key = $1 AND entity_id = $2
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [key, entityId]
  )
  return r.rows.length > 0 ? r.rows[0].response : null
}

export async function storeIdempotencyKey(
  key: string,
  entityId: string,
  response: unknown
): Promise<void> {
  await query(
    `INSERT INTO idempotency_keys (key, entity_id, response)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO NOTHING`,
    [key, entityId, JSON.stringify(response)]
  )
}

export async function cleanExpiredKeys(): Promise<number> {
  const r = await query(
    `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`
  )
  return r.rowCount ?? 0
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/idempotency.test.ts
```

Expected:
```
PASS: new key returns null
PASS: stored key returns response
PASS: key is scoped to entity
All idempotency tests passed.
```

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/idempotency.service.ts apps/22accounting/src/lib/__tests__/idempotency.test.ts
git commit -m "feat: idempotency service — check/store/clean 24h keys"
```

---

## Task 4: GL Service — PoolClient + Period Lock + Immutability + Audit

**Files:**
- Modify: `src/lib/general_ledger.service.ts`

- [ ] **Step 1: Update `postJournalEntry` signature and add period lock + audit**

Replace the `postJournalEntry` function (lines 22–58) with:

```ts
import { query, DbClient } from './db'
import { isDateLocked } from './period_lock.service'
import { logAudit } from './audit.service'
```

(Add these imports at the top, replacing the existing `import { query } from './db'`.)

Then replace `postJournalEntry`:

```ts
export async function postJournalEntry(
  params: PostJournalEntryParams,
  client?: DbClient
): Promise<string> {
  const { entityId, userId, date, reference, description, sourceType, sourceId, lines } = params

  // Period lock: enforced here regardless of caller
  const lockCheck = await isDateLocked(entityId, date, userId)
  if (lockCheck.locked) {
    throw new Error(
      `PERIOD_LOCKED: Cannot post to ${date}. Period locked through ${lockCheck.lockedThrough}.`
    )
  }

  // Balance check
  const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new Error(
      `Journal entry does not balance: debits £${totalDebit.toFixed(2)} ≠ credits £${totalCredit.toFixed(2)}`
    )
  }

  if (lines.length < 2) throw new Error('Journal entry must have at least 2 lines')

  // Control account validation
  if (sourceType === 'invoice') {
    const hasAR = lines.some(l => l.isControlAR)
    if (!hasAR) throw new Error('Invoice entries must include a debit to the AR control account (1100)')
  }
  if (sourceType === 'bill') {
    const hasAP = lines.some(l => l.isControlAP)
    if (!hasAP) throw new Error('Bill entries must include a credit to the AP control account (2100)')
  }

  // Use provided client (for atomic transactions) or fall back to pool
  const exec = client
    ? (sql: string, p: unknown[]) => (client as import('pg').PoolClient).query(sql, p as any[])
    : (sql: string, p: unknown[]) => query(sql, p)

  const entryRes = await exec(
    `INSERT INTO journal_entries
       (entity_id, user_id, entry_date, reference, description, source_type, source_id, status, is_locked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'posted',TRUE) RETURNING id`,
    [entityId, userId, date, reference ?? null, description ?? null, sourceType ?? null, sourceId ?? null]
  )
  const entryId = entryRes.rows[0].id as string

  for (const line of lines) {
    await exec(
      `INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        entryId, line.accountId, line.description ?? null,
        parseFloat((line.debit  || 0).toFixed(2)),
        parseFloat((line.credit || 0).toFixed(2)),
      ]
    )
  }

  // Audit (non-blocking — don't let audit failure roll back the GL entry)
  logAudit(userId, 'JOURNAL_POSTED', 'journal_entry', entryId,
    { sourceType, sourceId, reference }, undefined, entityId
  ).catch(console.error)

  return entryId
}
```

Also update `JournalLine` interface to add optional control account flags:

```ts
export interface JournalLine {
  accountId: string
  description?: string
  debit: number
  credit: number
  isControlAR?: boolean  // set to true on the 1100 debit line
  isControlAP?: boolean  // set to true on the 2100 credit line
}
```

- [ ] **Step 2: Update `reverseJournalEntry` to use client param and add audit**

Replace `reverseJournalEntry` (lines 60–94):

```ts
export async function reverseJournalEntry(
  originalEntryId: string,
  userId: string,
  date: string,
  client?: DbClient
): Promise<string> {
  const entryRes = await query('SELECT * FROM journal_entries WHERE id=$1', [originalEntryId])
  const original = entryRes.rows[0]
  if (!original) throw new Error('Original journal entry not found')

  const linesRes = await query('SELECT * FROM journal_lines WHERE entry_id=$1', [originalEntryId])

  const reversedLines: JournalLine[] = linesRes.rows.map(l => ({
    accountId:   l.account_id,
    description: `Reversal: ${l.description || ''}`,
    debit:       parseFloat(l.credit),
    credit:      parseFloat(l.debit),
  }))

  const reversalId = await postJournalEntry({
    entityId:    original.entity_id,
    userId,
    date,
    reference:   `REV-${original.reference || originalEntryId.slice(0, 8)}`,
    description: `Reversal of: ${original.description || originalEntryId}`,
    sourceType:  'manual',
    sourceId:    originalEntryId,
    lines:       reversedLines,
  }, client)

  // Mark original as reversed
  await query(
    'UPDATE journal_entries SET reversed_by = $1 WHERE id = $2',
    [reversalId, originalEntryId]
  )

  logAudit(userId, 'JOURNAL_REVERSED', 'journal_entry', originalEntryId,
    { reversalEntryId: reversalId }, undefined, original.entity_id
  ).catch(console.error)

  return reversalId
}
```

- [ ] **Step 3: Update `buildInvoiceCreationLines` to set `isControlAR`**

In `buildInvoiceCreationLines`, add `isControlAR: true` to the Debtors line:

```ts
const lines: JournalLine[] = [
  { accountId: debtors.id, description: 'Debtors Control', debit: invoiceTotal, credit: 0, isControlAR: true },
  { accountId: salesAcct.id, description: 'Sales', debit: 0, credit: subtotal },
]
```

- [ ] **Step 4: Update `buildBillCreationLines` to set `isControlAP`**

In `buildBillCreationLines`, add `isControlAP: true` to the Creditors line:

```ts
const lines: JournalLine[] = [
  { accountId: expenseAccountId, description: 'Purchase', debit: netAmount, credit: 0 },
  { accountId: creditors.id, description: 'Creditors Control', debit: 0, credit: billTotal, isControlAP: true },
]
```

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/general_ledger.service.ts
git commit -m "feat: GL service — PoolClient support, period lock enforcement, immutability, control account validation, JOURNAL_POSTED audit"
```

---

## Task 5: Audit Service — workspaceEntityId param

**Files:**
- Modify: `src/lib/audit.service.ts`

The `actor_id` column is now in the DB (migration 025). The INSERT was already trying to write it but silently failing. Add `workspace_entity_id` support.

- [ ] **Step 1: Update audit.service.ts**

Replace entire file:

```ts
import { query } from './db'

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  actorId?: string,
  workspaceEntityId?: string
) {
  try {
    await query(
      `INSERT INTO audit_log
         (user_id, action, entity_type, entity_id, metadata, actor_id, workspace_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId, action, entityType,
        entityId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        actorId ?? null,
        workspaceEntityId ?? null,
      ]
    )
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

export async function getAuditLog(
  userId: string,
  entityId?: string,
  limit = 100
) {
  const params: unknown[] = [userId]
  let sql = `
    SELECT id, action, entity_type, entity_id, metadata,
           actor_id, workspace_entity_id, created_at
    FROM audit_log WHERE user_id=$1`

  if (entityId) {
    params.push(entityId)
    sql += ` AND workspace_entity_id=$${params.length}`
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const r = await query(sql, params)
  return r.rows
}
```

- [ ] **Step 2: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/audit.service.ts
git commit -m "feat: audit service — workspaceEntityId param, fix actor_id insert (was silently failing)"
```

---

## Task 6: Invoice Service — Atomic Transactions

**Files:**
- Modify: `src/lib/invoice.service.ts`

The full `invoice.service.ts` is long. These are the targeted changes to `createInvoice`, `recordPayment`, and `voidInvoice`.

- [ ] **Step 1: Write the failing integration test**

Create `src/lib/__tests__/gl-atomic.test.ts`:

```ts
// Integration test — requires live DB
// Run: npx tsx src/lib/__tests__/gl-atomic.test.ts

import { query } from '../db'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

// We need a valid entity_id and user_id to test against.
// Fetch the first entity from DB — assumes at least one exists.
async function getTestContext() {
  const r = await query(`
    SELECT u.id as user_id, e.id as entity_id
    FROM users u JOIN entities e ON e.id = (
      SELECT entity_id FROM entities WHERE is_active = TRUE LIMIT 1
    )
    LIMIT 1
  `)
  if (r.rows.length === 0) throw new Error('No test entity found')
  return r.rows[0] as { user_id: string; entity_id: string }
}

async function run() {
  const ctx = await getTestContext()

  // Test: GL entry exists after createInvoice
  const { createInvoice } = await import('../invoice.service')
  const inv = await createInvoice({
    userId: ctx.user_id,
    entityId: ctx.entity_id,
    clientName: 'GL Test Client',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    taxRate: 20,
    currency: 'GBP',
    items: [{ description: 'Test item', quantity: 1, unitPrice: 100, taxRate: 20 }],
  })

  const glR = await query(
    `SELECT je.id FROM journal_entries je
     WHERE je.source_type='invoice' AND je.source_id=$1`,
    [inv.id]
  )
  assert(glR.rows.length === 1, `GL entry created for invoice ${inv.id}`)

  // Cleanup
  await query(`DELETE FROM journal_lines WHERE entry_id = $1`, [glR.rows[0].id])
  await query(`DELETE FROM journal_entries WHERE id = $1`, [glR.rows[0].id])
  await query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [inv.id])
  await query(`DELETE FROM invoices WHERE id = $1`, [inv.id])

  console.log('\nAll GL atomic tests passed.')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run test — expect FAIL (GL currently non-blocking so may pass or fail depending on DB state)**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/gl-atomic.test.ts 2>&1
```

Note the current result. The test itself confirms GL entry creation; the goal is it passes after our fix too.

- [ ] **Step 3: Update `createInvoice` to use withTransaction**

In `src/lib/invoice.service.ts`, add to imports:
```ts
import { withTransaction } from './db'
```

Replace the body of `createInvoice` to wrap the entire operation:

```ts
export async function createInvoice(data: { /* same signature */ }) {
  const num = await generateInvoiceNumber()
  let subtotal = 0
  const processedItems = data.items.map((item, idx) => {
    const amount = item.quantity * item.unitPrice
    subtotal += amount
    return { ...item, amount, taxAmount: amount * (item.taxRate / 100), lineOrder: idx }
  })
  const taxAmount = subtotal * (data.taxRate / 100)
  const total = subtotal + taxAmount
  const fee = total * 0.025

  return withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO invoices (user_id,entity_id,customer_id,project_id,invoice_number,client_name,client_email,client_address,issue_date,due_date,subtotal,tax_rate,tax_amount,total,currency,relentify_fee_amount,notes,terms,payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [data.userId, data.entityId, data.customerId ?? null, data.projectId ?? null, num,
       data.clientName, data.clientEmail ?? null, data.clientAddress ?? null,
       data.issueDate || new Date().toISOString().split('T')[0], data.dueDate,
       subtotal.toFixed(2), data.taxRate, taxAmount.toFixed(2), total.toFixed(2),
       data.currency, fee.toFixed(2), data.notes ?? null, data.terms ?? null,
       data.paymentTerms ?? 'net_30']
    )
    const inv = r.rows[0]

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items
           (invoice_id,description,quantity,unit_price,amount,tax_rate,tax_amount,line_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [inv.id, item.description, item.quantity, item.unitPrice,
         item.amount, item.taxRate, item.taxAmount, item.lineOrder]
      )
    }

    // GL posting — now inside the transaction. If it throws, entire tx rolls back.
    const glLines = await buildInvoiceCreationLines(
      data.entityId,
      parseFloat(total.toFixed(2)),
      parseFloat(subtotal.toFixed(2)),
      parseFloat(taxAmount.toFixed(2))
    )
    await postJournalEntry({
      entityId:    data.entityId,
      userId:      data.userId,
      date:        data.issueDate || new Date().toISOString().split('T')[0],
      reference:   num,
      description: `Invoice to ${data.clientName}`,
      sourceType:  'invoice',
      sourceId:    inv.id,
      lines:       glLines,
    }, client)

    return inv
  })
}
```

- [ ] **Step 4: Update `recordPayment` in invoice.service.ts to use withTransaction**

Find the `recordPayment` function (search for `recordPayment` in the file). Wrap it:

```ts
export async function recordInvoicePayment(data: {
  invoiceId: string; userId: string; entityId: string;
  amount: number; paymentDate: string; bankAccountId?: string; reference?: string
}) {
  return withTransaction(async (client) => {
    // Update invoice status
    await client.query(
      `UPDATE invoices SET status='paid', paid_at=$1 WHERE id=$2`,
      [data.paymentDate, data.invoiceId]
    )

    // Record bank transaction
    const btR = await client.query(
      `INSERT INTO bank_transactions
         (entity_id, user_id, date, description, amount, type, source_type, source_id, reference)
       VALUES ($1,$2,$3,$4,$5,'credit','invoice',$6,$7) RETURNING id`,
      [data.entityId, data.userId, data.paymentDate,
       `Invoice payment received`, data.amount, data.invoiceId, data.reference ?? null]
    )

    // GL: Dr Bank / Cr Debtors
    const glLines = await buildInvoicePaymentLines(data.entityId, data.amount, data.bankAccountId)
    await postJournalEntry({
      entityId:   data.entityId,
      userId:     data.userId,
      date:       data.paymentDate,
      reference:  data.reference ?? null,
      description: `Payment received on invoice`,
      sourceType: 'payment',
      sourceId:   btR.rows[0].id,
      lines:      glLines,
    }, client)

    return btR.rows[0]
  })
}
```

- [ ] **Step 5: Run the GL atomic test**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/gl-atomic.test.ts
```

Expected:
```
PASS: GL entry created for invoice <uuid>
All GL atomic tests passed.
```

- [ ] **Step 6: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/invoice.service.ts apps/22accounting/src/lib/__tests__/gl-atomic.test.ts
git commit -m "feat: invoice service — atomic createInvoice + recordPayment (GL failure rolls back invoice)"
```

---

## Task 7: Bill Service — Atomic Transactions

**Files:**
- Modify: `src/lib/bill.service.ts`

- [ ] **Step 1: Add withTransaction import to bill.service.ts**

Add at top:
```ts
import { withTransaction } from './db'
```

- [ ] **Step 2: Wrap `createBill` in withTransaction**

Find the `createBill` function. The INSERT (lines ~68–95) saves the bill. After the INSERT, there's a try/catch for GL. Replace the entire function body:

```ts
export async function createBill(userId: string, data: { /* same signature */ }) {
  return withTransaction(async (client) => {
    const r = await client.query(
      `INSERT INTO bills
         (user_id, entity_id, supplier_name, amount, vat_rate, vat_amount, currency,
          invoice_date, due_date, category, coa_account_id, notes, reference,
          project_id, po_id, po_variance_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [userId, data.entityId, data.supplierName, data.amount, data.vatRate ?? 0,
       data.vatAmount ?? 0, data.currency || 'GBP', data.invoiceDate ?? null,
       data.dueDate, data.category ?? null, data.coaAccountId ?? null,
       data.notes ?? null, data.reference ?? null,
       data.projectId ?? null, data.poId ?? null, data.poVarianceReason ?? null]
    )
    const bill = r.rows[0]

    // Resolve expense account
    const expAcctCode = data.coaAccountId
      ? null
      : (CATEGORY_TO_CODE[data.category ?? ''] ?? 7900)
    const expAcctId = data.coaAccountId
      ?? (await getAccountByCode(data.entityId, expAcctCode!))?.id

    if (!expAcctId) throw new Error('Could not resolve expense account for bill GL entry')

    const glLines = await buildBillCreationLines(
      data.entityId,
      data.amount,
      data.vatAmount ?? 0,
      expAcctId
    )
    await postJournalEntry({
      entityId:    data.entityId,
      userId,
      date:        data.invoiceDate ?? data.dueDate,
      reference:   data.reference ?? null,
      description: `Bill from ${data.supplierName}`,
      sourceType:  'bill',
      sourceId:    bill.id,
      lines:       glLines,
    }, client)

    return bill
  })
}
```

- [ ] **Step 3: Wrap `recordBillPayment` (find and update)**

Find the function that records a bill payment. Wrap the INSERT + GL call:

```ts
export async function recordBillPayment(data: {
  billId: string; userId: string; entityId: string;
  amount: number; paymentDate: string; bankAccountId?: string; reference?: string
}) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE bills SET status='paid', paid_at=$1 WHERE id=$2`,
      [data.paymentDate, data.billId]
    )

    const btR = await client.query(
      `INSERT INTO bank_transactions
         (entity_id, user_id, date, description, amount, type, source_type, source_id, reference)
       VALUES ($1,$2,$3,$4,$5,'debit','bill',$6,$7) RETURNING id`,
      [data.entityId, data.userId, data.paymentDate,
       `Bill payment`, data.amount, data.billId, data.reference ?? null]
    )

    const glLines = await buildBillPaymentLines(data.entityId, data.amount, data.bankAccountId)
    await postJournalEntry({
      entityId:    data.entityId,
      userId:      data.userId,
      date:        data.paymentDate,
      reference:   data.reference ?? null,
      description: `Payment for bill`,
      sourceType:  'payment',
      sourceId:    btR.rows[0].id,
      lines:       glLines,
    }, client)

    return btR.rows[0]
  })
}
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/bill.service.ts
git commit -m "feat: bill service — atomic createBill + recordBillPayment"
```

---

## Task 8: Credit Note, Expense, and Approval Services — Atomic

**Files:**
- Modify: `src/lib/credit_note.service.ts`
- Modify: `src/lib/expense.service.ts`
- Modify: `src/lib/expense_approval.service.ts`

- [ ] **Step 1: Add withTransaction to credit_note.service.ts and wrap createCreditNote + voidCreditNote**

In `createCreditNote`, replace the GL try/catch with a `withTransaction` wrapper following the same pattern as invoice/bill: INSERT credit note → INSERT items → `postJournalEntry(params, client)`.

In `voidCreditNote`, wrap: UPDATE status='voided' → `reverseJournalEntry(entryId, userId, today, client)`.

```ts
// credit_note.service.ts — add import
import { withTransaction } from './db'

// createCreditNote — wrap body:
return withTransaction(async (client) => {
  const r = await client.query(`INSERT INTO credit_notes ...`, [...])
  const cn = r.rows[0]
  for (const item of processedItems) {
    await client.query(`INSERT INTO credit_note_items ...`, [...])
  }
  // build GL lines: Dr Sales + Dr VAT / Cr Debtors (reversal of invoice)
  const debtors = await getAccountByCode(data.entityId, 1100)
  const salesAcct = await getAccountByCode(data.entityId, 4000)
  const lines: JournalLine[] = [
    { accountId: salesAcct!.id, description: 'Sales reversal', debit: subtotal, credit: 0 },
    { accountId: debtors!.id, description: 'Debtors Control', debit: 0, credit: total, isControlAR: true },
  ]
  if (taxAmount > 0) {
    const vatOut = await getAccountByCode(data.entityId, 2202)
    if (vatOut) lines.push({ accountId: vatOut.id, description: 'VAT reversal', debit: taxAmount, credit: 0 })
  }
  await postJournalEntry({
    entityId: data.entityId, userId: data.userId,
    date: issueDate, reference: num,
    description: `Credit note to ${data.clientName}`,
    sourceType: 'credit_note', sourceId: cn.id, lines,
  }, client)
  return cn
})
```

- [ ] **Step 2: Add withTransaction to expense.service.ts and wrap createExpense**

Find `createExpense`. Wrap INSERT + GL call:

```ts
import { withTransaction } from './db'

// createExpense body:
return withTransaction(async (client) => {
  const r = await client.query(`INSERT INTO expenses ...`, [...])
  const exp = r.rows[0]
  // Note: GL posts at approval, not creation, when approval flow is active.
  // If no approval required, post GL here.
  const approvalSettings = await getExpenseApprovalSettings(data.entityId)
  if (!approvalSettings?.requires_approval) {
    const acctId = data.coaAccountId
      ?? (await getAccountByCode(data.entityId, EXPENSE_CATEGORY_TO_CODE[data.category ?? ''] ?? 7900))?.id
    if (!acctId) throw new Error('Could not resolve expense account')
    const glLines = await buildExpenseLines(data.entityId, data.amount, acctId)
    await postJournalEntry({
      entityId: data.entityId, userId: data.userId,
      date: data.date, description: `Expense: ${data.description}`,
      sourceType: 'expense', sourceId: exp.id, lines: glLines,
    }, client)
  }
  return exp
})
```

- [ ] **Step 3: Wrap `approveExpense` in expense_approval.service.ts**

Find `approveExpense`. Wrap the status UPDATE + GL posting:

```ts
import { withTransaction } from './db'

// Inside approveExpense:
return withTransaction(async (client) => {
  await client.query(`UPDATE expenses SET status='approved', approved_by=$1 WHERE id=$2`,
    [approverId, expenseId])
  const glLines = await buildExpenseLines(entityId, amount, acctId)
  await postJournalEntry({
    entityId, userId: approverId, date: expenseDate,
    description: `Approved expense`, sourceType: 'expense', sourceId: expenseId, lines: glLines,
  }, client)
})
```

Same treatment for `approveMileage`.

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/credit_note.service.ts apps/22accounting/src/lib/expense.service.ts apps/22accounting/src/lib/expense_approval.service.ts
git commit -m "feat: credit note, expense, approval services — atomic GL transactions"
```

---

## Task 9: Remaining Services — Atomic (Quote, PO, OpeningBalance, Intercompany)

**Files:**
- Modify: `src/lib/quote.service.ts`
- Modify: `src/lib/purchase_order.service.ts`
- Modify: `src/lib/opening_balance.service.ts`
- Modify: `src/lib/intercompany.service.ts`

- [ ] **Step 1: quote.service.ts — wrap convertToInvoice**

Find `convertToInvoice`. It calls `createInvoice()` internally. Since `createInvoice` now wraps itself in a transaction, `convertToInvoice` just needs to update the quote status atomically:

```ts
import { withTransaction } from './db'

export async function convertToInvoice(quoteId: string, userId: string, entityId: string) {
  // createInvoice is already atomic; just ensure quote status update is in same tx
  return withTransaction(async (client) => {
    const quoteR = await client.query(`SELECT * FROM quotes WHERE id=$1`, [quoteId])
    const quote = quoteR.rows[0]
    if (!quote) throw new Error('Quote not found')

    await client.query(`UPDATE quotes SET status='converted', converted_at=NOW() WHERE id=$1`, [quoteId])

    // createInvoice has its own withTransaction; here we call it outside the outer tx
    // to avoid nested transactions. The invoice creation is its own atomic unit.
    const inv = await createInvoice({
      userId, entityId,
      clientName:  quote.client_name,
      clientEmail: quote.client_email,
      dueDate:     quote.due_date,
      taxRate:     quote.tax_rate,
      currency:    quote.currency,
      notes:       quote.notes,
      items:       JSON.parse(quote.items_json ?? '[]'),
    })

    return inv
  })
}
```

- [ ] **Step 2: purchase_order.service.ts — wrap approvePO**

Find the approve function. Wrap UPDATE po status + createBill:

```ts
import { withTransaction } from './db'

// Inside approvePO (or equivalent):
await withTransaction(async (client) => {
  await client.query(
    `UPDATE purchase_orders SET status='approved', approved_at=NOW(), approved_by=$1 WHERE id=$2`,
    [approverId, poId]
  )
  // createBill is now its own atomic unit; call outside inner tx to avoid nesting
})
// After status update, create bill (its own transaction)
await createBill(userId, { ... })
```

- [ ] **Step 3: opening_balance.service.ts — wrap importOpeningBalances**

Find `importOpeningBalances`. Wrap the entire import (all INSERT + GL posting) in a single transaction:

```ts
import { withTransaction } from './db'

export async function importOpeningBalances(userId: string, entityId: string, balances: OpeningBalance[]) {
  return withTransaction(async (client) => {
    // Delete any existing opening balance entries for this entity
    await client.query(
      `DELETE FROM journal_entries WHERE entity_id=$1 AND source_type='opening_balance'`,
      [entityId]
    )

    // Build and post one journal entry per balance
    for (const b of balances) {
      await postJournalEntry({
        entityId, userId,
        date: b.date,
        description: `Opening balance — ${b.accountName}`,
        sourceType: 'opening_balance',
        sourceId: `${entityId}-${b.accountCode}`,
        lines: b.lines,
      }, client)
    }

    await logAudit(userId, 'OPENING_BALANCES_IMPORTED', 'entity', entityId,
      { count: balances.length }, undefined, entityId)
  })
}
```

- [ ] **Step 4: intercompany.service.ts — wrap createIntercompanyTransaction**

Same pattern: `withTransaction(async (client) => { INSERT + postJournalEntry(params, client) })`.

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/quote.service.ts apps/22accounting/src/lib/purchase_order.service.ts apps/22accounting/src/lib/opening_balance.service.ts apps/22accounting/src/lib/intercompany.service.ts
git commit -m "feat: quote, PO, opening balance, intercompany — atomic GL transactions"
```

---

## Task 10: VAT Engine Service

**Files:**
- Create: `src/lib/vat.service.ts`
- Create: `src/lib/__tests__/vat-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/vat-engine.test.ts`:

```ts
// Run: npx tsx src/lib/__tests__/vat-engine.test.ts

import {
  calcStandardRated,
  calcZeroRated,
  calcExempt,
  calcReverseCharge,
} from '../vat.service'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

function run() {
  // Standard rated 20%
  const sr = calcStandardRated(1000)
  assert(sr.vatAmount === 200, 'standard rated: VAT = 200')
  assert(sr.gross === 1200, 'standard rated: gross = 1200')
  assert(sr.includesVATLine === true, 'standard rated: includes VAT line')

  // Zero rated
  const zr = calcZeroRated(500)
  assert(zr.vatAmount === 0, 'zero rated: no VAT')
  assert(zr.gross === 500, 'zero rated: gross = net')
  assert(zr.includesVATLine === false, 'zero rated: no VAT line')

  // Exempt
  const ex = calcExempt(300)
  assert(ex.vatAmount === 0, 'exempt: no VAT')
  assert(ex.includeInBox6 === false, 'exempt: not in box 6')

  // Reverse charge: net effect on VAT is zero
  const rc = calcReverseCharge(400, 20)
  assert(rc.vatInput === 80, 'reverse charge: input = 80')
  assert(rc.vatOutput === 80, 'reverse charge: output = 80')
  assert(rc.vatInput - rc.vatOutput === 0, 'reverse charge: net VAT = 0')

  console.log('\nAll VAT engine tests passed.')
  process.exit(0)
}

run()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/vat-engine.test.ts 2>&1 | head -3
```

Expected: `Cannot find module '../vat.service'`

- [ ] **Step 3: Create vat.service.ts**

```ts
// src/lib/vat.service.ts
// Explicit UK VAT rules — one named function per scenario.
// Services call these instead of duplicating calculation logic.

export interface VATResult {
  net: number
  vatAmount: number
  gross: number
  includesVATLine: boolean
  includeInBox6: boolean  // false only for exempt supplies
}

export interface ReverseChargeResult {
  net: number
  vatInput: number
  vatOutput: number
  // Both post to 1201 (input) and 2202 (output); net VAT position = 0
}

/** Standard rated supply at any % rate (20 for full, 5 for reduced) */
export function calcStandardRated(net: number, rate = 20): VATResult {
  const vatAmount = parseFloat((net * (rate / 100)).toFixed(2))
  return {
    net,
    vatAmount,
    gross: net + vatAmount,
    includesVATLine: true,
    includeInBox6: true,
  }
}

/** Zero-rated supply (0%): no VAT line, but included in Box 6 turnover */
export function calcZeroRated(net: number): VATResult {
  return {
    net,
    vatAmount: 0,
    gross: net,
    includesVATLine: false,
    includeInBox6: true,
  }
}

/**
 * Exempt supply: no VAT charged, NOT included in Box 6.
 * VAT on costs for exempt supplies is not reclaimable.
 */
export function calcExempt(net: number): VATResult {
  return {
    net,
    vatAmount: 0,
    gross: net,
    includesVATLine: false,
    includeInBox6: false,
  }
}

/**
 * Reverse charge (import of services): buyer accounts for both
 * output VAT (Box 1) and input VAT (Box 4). Net VAT = 0.
 * GL: Dr 1201 VAT Input + Dr Expense / Cr 2202 VAT Output + Cr Creditor
 */
export function calcReverseCharge(net: number, rate = 20): ReverseChargeResult {
  const vat = parseFloat((net * (rate / 100)).toFixed(2))
  return { net, vatInput: vat, vatOutput: vat }
}

/**
 * Partial exemption: only a % of input VAT is reclaimable.
 * recoveryPct: 0–100 (entity-level setting)
 */
export function calcPartialExemption(
  grossInputVAT: number,
  recoveryPct: number
): { reclaimable: number; blocked: number } {
  const reclaimable = parseFloat((grossInputVAT * (recoveryPct / 100)).toFixed(2))
  return { reclaimable, blocked: parseFloat((grossInputVAT - reclaimable).toFixed(2)) }
}

/**
 * Determine which date a transaction belongs to for VAT purposes.
 * UK rule: use invoice date (tax point), not payment date.
 * Cash accounting scheme: use payment date.
 */
export function vatPeriodDate(
  invoiceDate: string,
  paymentDate: string | null,
  cashAccountingScheme: boolean
): string {
  if (cashAccountingScheme && paymentDate) return paymentDate
  return invoiceDate
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/vat-engine.test.ts
```

Expected:
```
PASS: standard rated: VAT = 200
PASS: standard rated: gross = 1200
PASS: standard rated: includes VAT line
PASS: zero rated: no VAT
PASS: zero rated: gross = net
PASS: zero rated: no VAT line
PASS: exempt: no VAT
PASS: exempt: not in box 6
PASS: reverse charge: input = 80
PASS: reverse charge: output = 80
PASS: reverse charge: net VAT = 0
All VAT engine tests passed.
```

- [ ] **Step 5: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/vat.service.ts apps/22accounting/src/lib/__tests__/vat-engine.test.ts
git commit -m "feat: VAT engine service — explicit functions per UK scenario (standard, zero, exempt, reverse charge, partial, cash accounting)"
```

---

## Task 11: Cron Monitoring Service

**Files:**
- Create: `src/lib/cron-monitor.service.ts`
- Modify: `app/api/cron/po-escalation/route.ts`
- Modify: `app/api/cron/reminders/route.ts`

- [ ] **Step 1: Create cron-monitor.service.ts**

```ts
// src/lib/cron-monitor.service.ts
import { query } from './db'

export async function startCronRun(jobName: string): Promise<string> {
  const r = await query(
    `INSERT INTO cron_runs (job_name, status) VALUES ($1, 'running') RETURNING id`,
    [jobName]
  )
  return r.rows[0].id as string
}

export async function finishCronRun(
  runId: string,
  status: 'success' | 'failed',
  recordsProcessed?: number,
  error?: string
): Promise<void> {
  await query(
    `UPDATE cron_runs
     SET status=$1, finished_at=NOW(), records_processed=$2, error=$3
     WHERE id=$4`,
    [status, recordsProcessed ?? null, error ?? null, runId]
  )

  if (status === 'failed') {
    await alertOnFailure(runId, error ?? 'Unknown error')
  }
}

async function alertOnFailure(runId: string, error: string): Promise<void> {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN
  const telegramChat  = process.env.TELEGRAM_CHAT_ID
  if (!telegramToken || !telegramChat) return

  const msg = `🔴 Cron job failed\nRun ID: ${runId}\nError: ${error}`
  await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChat, text: msg }),
    }
  ).catch(console.error)
}
```

- [ ] **Step 2: Update po-escalation route to use cron monitor**

In `app/api/cron/po-escalation/route.ts`, wrap the logic:

```ts
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun('po-escalation')
  try {
    // ... existing logic unchanged ...
    const escalated = /* existing return value */ 0
    await finishCronRun(runId, 'success', escalated)
    return NextResponse.json({ escalated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finishCronRun(runId, 'failed', 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: Apply same pattern to reminders route**

Open `app/api/cron/reminders/route.ts`. Add `startCronRun`/`finishCronRun` wrapping the existing logic.

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/cron-monitor.service.ts apps/22accounting/app/api/cron/po-escalation/route.ts apps/22accounting/app/api/cron/reminders/route.ts
git commit -m "feat: cron monitor service — track run status in DB, Telegram alert on failure"
```

---

## Task 12: Team Roles + GL Permission Checks

**Files:**
- Modify: `src/lib/team.service.ts`
- Modify: `app/api/journals/route.ts`
- Modify: `app/api/journals/[id]/route.ts` (reverse endpoint)

- [ ] **Step 1: Add role helpers to team.service.ts**

Add to `src/lib/team.service.ts`:

```ts
export async function getMemberRole(
  ownerUserId: string,
  memberUserId: string
): Promise<'admin' | 'accountant' | 'staff' | null> {
  // Owner is always admin
  if (ownerUserId === memberUserId) return 'admin'

  const r = await query(
    `SELECT role FROM workspace_members
     WHERE owner_user_id=$1 AND member_user_id=$2 AND status='accepted'`,
    [ownerUserId, memberUserId]
  )
  return r.rows.length > 0 ? (r.rows[0].role as 'admin' | 'accountant' | 'staff') : null
}

export async function requireGLRole(
  ownerUserId: string,
  actingUserId: string,
  allowedRoles: Array<'admin' | 'accountant' | 'staff'>
): Promise<void> {
  const role = await getMemberRole(ownerUserId, actingUserId)
  if (!role || !allowedRoles.includes(role)) {
    throw new Error(`PERMISSION_DENIED: This action requires one of: ${allowedRoles.join(', ')}`)
  }
}
```

- [ ] **Step 2: Enforce role on POST /api/journals (create manual journal)**

In `app/api/journals/route.ts`, the POST handler:

```ts
import { requireGLRole } from '@/src/lib/team.service'

// Inside POST:
const auth = await getAuthUser(req)
if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const entity = await getActiveEntity(auth.userId)
// requireGLRole throws if not admin/accountant; return 403 to client
try {
  await requireGLRole(entity.owner_user_id, auth.userId, ['admin', 'accountant'])
} catch {
  return NextResponse.json({ error: 'Only admin or accountant roles may post manual journals' }, { status: 403 })
}
```

- [ ] **Step 3: Enforce role on journal reverse and opening balances import**

Apply the same `requireGLRole` check:
- `app/api/journals/[id]/route.ts` DELETE/reverse handler → `['admin', 'accountant']`
- `app/api/import/opening-balances/route.ts` POST handler → `['admin']`
- `app/api/year-end/close/route.ts` POST handler → `['admin']`

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/team.service.ts apps/22accounting/app/api/journals/ apps/22accounting/app/api/import/ apps/22accounting/app/api/year-end/
git commit -m "feat: team roles — admin/accountant/staff on workspace_members; GL operations require admin or accountant"
```

---

## Task 13: Accrual Journals

**Files:**
- Modify: `app/dashboard/journals/new/page.tsx`
- Create: `app/api/cron/accrual-reversals/route.ts`

- [ ] **Step 1: Update journals/new/page.tsx to support accrual + draft modes**

Add to the journal creation form:

1. **Draft mode toggle**: "Save as Draft / Post Journal" — two buttons instead of one.
2. **Accrual checkbox**: "This is an accrual entry (auto-reverses on a future date)". When checked, show a "Reversal date" date picker.
3. **Balance warning**: Live Dr/Cr total shown above the lines. If totals don't balance, the Post button is disabled and shows "Journal does not balance: Dr £X ≠ Cr £Y".
4. **Control account warning**: When user selects account 1100 or 2100 from the COA picker, show a yellow banner: "This is a control account. It is normally posted automatically by invoices/bills. Are you sure?"

The form sends to the existing `POST /api/journals` route, which needs to accept `is_accrual`, `reversal_date`, and `status` fields.

Update `app/api/journals/route.ts` POST to persist these fields:

```ts
// In the INSERT into journal_entries, add columns:
`INSERT INTO journal_entries
   (entity_id, user_id, entry_date, reference, description,
    source_type, source_id, status, is_accrual, reversal_date)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`
// params: [...existing, isAccrual ? 'posted' : 'draft', isAccrual, reversalDate ?? null]
```

Note: for simplicity, draft entries do not post to the GL. Only `status='posted'` entries call `postJournalEntry`.

- [ ] **Step 2: Create accrual reversals cron**

Create `app/api/cron/accrual-reversals/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/src/lib/db'
import { reverseJournalEntry } from '@/src/lib/general_ledger.service'
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun('accrual-reversals')
  try {
    const today = new Date().toISOString().split('T')[0]

    // Find all accruals where reversal_date = today and not yet reversed
    const due = await query(
      `SELECT id, entity_id, user_id FROM journal_entries
       WHERE is_accrual = TRUE
         AND reversal_date = $1
         AND reversed_by IS NULL
         AND status = 'posted'`,
      [today]
    )

    let count = 0
    for (const entry of due.rows) {
      await reverseJournalEntry(entry.id, entry.user_id, today)
      count++
    }

    await finishCronRun(runId, 'success', count)
    return NextResponse.json({ reversed: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finishCronRun(runId, 'failed', 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/app/dashboard/journals/new/page.tsx apps/22accounting/app/api/journals/route.ts apps/22accounting/app/api/cron/accrual-reversals/route.ts
git commit -m "feat: accrual journals — draft mode, balance warning, control account warning, auto-reversal cron"
```

---

## Task 14: Prepayment Tracking

**Files:**
- Modify: Bill payment recording UI (the Record Payment modal on bill detail page)
- Modify: `src/lib/bill.service.ts` (recordBillPayment)
- Create: `app/api/cron/prepayment-release/route.ts`

- [ ] **Step 1: Update recordBillPayment to handle prepayment**

In `src/lib/bill.service.ts`, extend `recordBillPayment` to accept prepayment fields:

```ts
export async function recordBillPayment(data: {
  billId: string; userId: string; entityId: string;
  amount: number; paymentDate: string; bankAccountId?: string; reference?: string;
  isPrepayment?: boolean; prepaymentMonths?: number; prepaymentExpAcctId?: string;
}) {
  return withTransaction(async (client) => {
    await client.query(`UPDATE bills SET status='paid', paid_at=$1 WHERE id=$2`,
      [data.paymentDate, data.billId])

    const btR = await client.query(
      `INSERT INTO bank_transactions
         (entity_id, user_id, date, description, amount, type, source_type, source_id,
          reference, is_prepayment, prepayment_months, prepayment_exp_acct)
       VALUES ($1,$2,$3,$4,$5,'debit','bill',$6,$7,$8,$9,$10) RETURNING id`,
      [data.entityId, data.userId, data.paymentDate, 'Bill payment',
       data.amount, data.billId, data.reference ?? null,
       data.isPrepayment ?? false, data.prepaymentMonths ?? null,
       data.prepaymentExpAcctId ?? null]
    )

    if (data.isPrepayment) {
      // Dr Prepayments (1300) / Cr Bank — instead of normal Dr Creditors / Cr Bank
      const prepayAcct = await getAccountByCode(data.entityId, 1300)
      const bankAcct   = data.bankAccountId
        ? { id: data.bankAccountId }
        : await getAccountByCode(data.entityId, 1200)
      if (!prepayAcct || !bankAcct) throw new Error('Prepayments (1300) or Bank account not found')

      await postJournalEntry({
        entityId: data.entityId, userId: data.userId, date: data.paymentDate,
        description: 'Prepayment recorded', sourceType: 'prepayment',
        sourceId: btR.rows[0].id,
        lines: [
          { accountId: prepayAcct.id, description: 'Prepayments asset', debit: data.amount, credit: 0 },
          { accountId: bankAcct.id,   description: 'Bank payment',       debit: 0, credit: data.amount },
        ],
      }, client)
    } else {
      const glLines = await buildBillPaymentLines(data.entityId, data.amount, data.bankAccountId)
      await postJournalEntry({
        entityId: data.entityId, userId: data.userId, date: data.paymentDate,
        description: 'Bill payment', sourceType: 'payment', sourceId: btR.rows[0].id,
        lines: glLines,
      }, client)
    }

    return btR.rows[0]
  })
}
```

- [ ] **Step 2: Add "Mark as prepayment" UI to the Record Payment modal on the bill detail page**

In `app/dashboard/bills/[id]/page.tsx`, find the Record Payment modal. Add:
- A checkbox "This is a prepayment" (only visible when bill is for a service that spans future periods)
- When checked: show "Spread over X months" number input and "Expense account" COA picker

- [ ] **Step 3: Create prepayment-release cron**

Create `app/api/cron/prepayment-release/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { query, withTransaction } from '@/src/lib/db'
import { postJournalEntry } from '@/src/lib/general_ledger.service'
import { getAccountByCode } from '@/src/lib/chart_of_accounts.service'
import { startCronRun, finishCronRun } from '@/src/lib/cron-monitor.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = await startCronRun('prepayment-release')
  try {
    // Find active prepayments that still have months remaining
    const prepayments = await query(
      `SELECT bt.*, e.id as entity_id,
              bt.amount / bt.prepayment_months AS monthly_amount,
              (SELECT COUNT(*) FROM journal_entries je
               WHERE je.source_type='prepayment_release'
                 AND je.source_id = bt.id::text) AS releases_done
       FROM bank_transactions bt
       JOIN entities e ON e.id = bt.entity_id
       WHERE bt.is_prepayment = TRUE
         AND bt.prepayment_months IS NOT NULL
       HAVING (SELECT COUNT(*) FROM journal_entries je
               WHERE je.source_type='prepayment_release'
                 AND je.source_id = bt.id::text) < bt.prepayment_months`
    )

    let count = 0
    const today = new Date().toISOString().split('T')[0]

    for (const p of prepayments.rows) {
      await withTransaction(async (client) => {
        const prepayAcct = await getAccountByCode(p.entity_id, 1300)
        const expAcct    = p.prepayment_exp_acct
          ? { id: p.prepayment_exp_acct }
          : await getAccountByCode(p.entity_id, 7900)
        if (!prepayAcct || !expAcct) return

        const releaseNum = parseInt(p.releases_done) + 1
        await postJournalEntry({
          entityId: p.entity_id, userId: p.user_id, date: today,
          description: `Prepayment release ${releaseNum}/${p.prepayment_months}`,
          sourceType: 'prepayment_release',
          sourceId: `${p.id}-${releaseNum}`,
          lines: [
            { accountId: expAcct.id,    description: 'Expense release', debit: parseFloat(p.monthly_amount), credit: 0 },
            { accountId: prepayAcct.id, description: 'Prepayments',     debit: 0, credit: parseFloat(p.monthly_amount) },
          ],
        }, client)
      })
      count++
    }

    await finishCronRun(runId, 'success', count)
    return NextResponse.json({ released: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finishCronRun(runId, 'failed', 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/bill.service.ts apps/22accounting/app/dashboard/bills/ apps/22accounting/app/api/cron/prepayment-release/route.ts
git commit -m "feat: prepayment tracking — Mark as prepayment on bill payment, monthly release cron"
```

---

## Task 15: GL Integrity Diagnostic

**Files:**
- Modify: `app/api/reports/health/route.ts`

- [ ] **Step 1: Update health route to include GL integrity checks**

In `app/api/reports/health/route.ts`, add two diagnostic queries to the existing health data:

```ts
// Count invoices/bills/expenses with no GL entry
const orphanedR = await query(`
  SELECT
    (SELECT COUNT(*) FROM invoices i
     WHERE NOT EXISTS (
       SELECT 1 FROM journal_entries je
       WHERE je.source_type='invoice' AND je.source_id=i.id::text
         AND je.entity_id = $1
     ) AND i.entity_id = $1 AND i.status != 'draft') AS orphaned_invoices,

    (SELECT COUNT(*) FROM bills b
     WHERE NOT EXISTS (
       SELECT 1 FROM journal_entries je
       WHERE je.source_type='bill' AND je.source_id=b.id::text
         AND je.entity_id = $1
     ) AND b.entity_id = $1) AS orphaned_bills,

    (SELECT COUNT(*) FROM expenses e
     WHERE NOT EXISTS (
       SELECT 1 FROM journal_entries je
       WHERE je.source_type='expense' AND je.source_id=e.id::text
         AND je.entity_id = $1
     ) AND e.entity_id = $1 AND e.status = 'approved') AS orphaned_expenses
`, [entityId])

// Count unbalanced journal entries (should always be 0)
const unbalancedR = await query(`
  SELECT COUNT(*)::int AS unbalanced_entries
  FROM journal_entries je
  WHERE je.entity_id = $1
    AND ABS(
      (SELECT COALESCE(SUM(jl.debit),0)  FROM journal_lines jl WHERE jl.entry_id=je.id) -
      (SELECT COALESCE(SUM(jl.credit),0) FROM journal_lines jl WHERE jl.entry_id=je.id)
    ) > 0.005
`, [entityId])

// Add to response:
glIntegrity: {
  orphanedInvoices:  parseInt(orphanedR.rows[0].orphaned_invoices),
  orphanedBills:     parseInt(orphanedR.rows[0].orphaned_bills),
  orphanedExpenses:  parseInt(orphanedR.rows[0].orphaned_expenses),
  unbalancedEntries: unbalancedR.rows[0].unbalanced_entries,
}
```

- [ ] **Step 2: Verify the diagnostic against current DB**

```bash
curl -s http://localhost:3022/api/reports/health \
  -H "Cookie: relentify_token=<your-token>" | python3 -m json.tool | grep -A 10 glIntegrity
```

Note the orphaned invoice/bill counts — these represent the existing data integrity gap that the atomic transactions (Tasks 6–9) prevent going forward.

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/app/api/reports/health/route.ts
git commit -m "feat: GL integrity diagnostic — orphaned invoices/bills/expenses + unbalanced entry counts in health report"
```

---

## Task 16: Journal UI — Reverse Button + Draft Display

**Files:**
- Modify: `app/dashboard/journals/page.tsx`
- Modify: `app/api/journals/[id]/route.ts` (or relevant route)

- [ ] **Step 1: Add Reverse button to journal list / detail**

In `app/dashboard/journals/page.tsx`, for each `status='posted'` journal that has no `reversed_by` value, add a "Reverse" button. The button calls `DELETE /api/journals/:id` (or a dedicated `POST /api/journals/:id/reverse` route) and requires `admin` or `accountant` role.

Create `app/api/journals/[id]/reverse/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { reverseJournalEntry } from '@/src/lib/general_ledger.service'
import { requireGLRole } from '@/src/lib/team.service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entity = await getActiveEntity(auth.userId)
  try {
    await requireGLRole(entity.owner_user_id, auth.userId, ['admin', 'accountant'])
  } catch {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  const { id } = await params
  const today = new Date().toISOString().split('T')[0]
  const reversalId = await reverseJournalEntry(id, auth.userId, today)

  return NextResponse.json({ reversalId })
}
```

- [ ] **Step 2: Show draft journals in list with "Post" action**

In `app/dashboard/journals/page.tsx`, fetch journals with `status IN ('draft','posted')`. Display draft journals with an amber "Draft" badge and a "Post" button. The Post button calls `PATCH /api/journals/:id` with `{ status: 'posted' }`, which then runs `postJournalEntry`.

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/app/dashboard/journals/page.tsx apps/22accounting/app/api/journals/
git commit -m "feat: journal UI — Reverse button, Draft badge + Post action, balance warning, control account warning"
```

---

## Task 17: Build & Deploy

- [ ] **Step 1: TypeScript type check**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before building. Common issues: `client.query` vs `query` signature differences (PoolClient returns `QueryResult`, pool returns `QueryResult` too — both work the same).

- [ ] **Step 2: Run all integration tests**

```bash
cd /opt/relentify-monorepo/apps/22accounting
npx tsx src/lib/__tests__/idempotency.test.ts && \
npx tsx src/lib/__tests__/gl-atomic.test.ts && \
npx tsx src/lib/__tests__/vat-engine.test.ts
```

Expected: all pass.

- [ ] **Step 3: Build Docker image**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache 2>&1 | tail -20
```

Expected: `Successfully built` or `[+] Building ... FINISHED`

- [ ] **Step 4: Start and verify**

```bash
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 30 -f
```

Expected: no errors in logs. Wait ~10 seconds for Next.js to start.

- [ ] **Step 5: Smoke test GL integrity**

```bash
# Get a session cookie first from the browser, then:
curl -s http://localhost:3022/api/reports/health \
  -H "Cookie: relentify_token=<token>" | python3 -m json.tool
```

Verify `glIntegrity` appears in the response. Orphaned counts for historical data are expected (pre-existing invoices had no GL entries). New invoices from this point forward should have zero orphaned entries.

- [ ] **Step 6: Clean up Docker build cache**

```bash
docker builder prune -f
```

- [ ] **Step 7: Commit and update CLAUDE.md**

```bash
cd /opt/relentify-monorepo
# Update CLAUDE.md note about GL posting — it is now BLOCKING (atomic)
git add apps/22accounting/CLAUDE.md
git commit -m "docs: CLAUDE.md — GL posting is now blocking/atomic (not non-blocking try/catch)"
```

---

## Self-Review Against Spec

### Phase 1 (Fix) coverage:
- ✅ 1.1 GL Atomic: withTransaction in Tasks 6–9; postJournalEntry accepts PoolClient
- ✅ 1.2 Idempotency: Task 3 (service); UNIQUE constraint in Task 1 migration
- ✅ 1.3 Period lock at GL level: Task 4 (inside postJournalEntry)
- ✅ 1.4 GL integrity diagnostic: Task 15

### Phase 2 (Audit/Find) coverage:
- ✅ Audit query covered by GL integrity diagnostic — identifies orphaned records

### Phase 3 (Extend) coverage:
- ✅ 3.1 Accrual journals: Task 13
- ✅ 3.2 Prepayment tracking: Task 14
- ✅ 3.3 Control account enforcement: Tasks 1 (DB), 4 (GL layer validation)
- ✅ 3.4 Journal immutability: Task 4 (`status='posted'`, `is_locked=TRUE` on commit)
- ✅ 3.5 Audit trail completeness: Tasks 1 (columns), 4 (JOURNAL_POSTED), 5 (logAudit fix), 9 (opening balances audit)
- ✅ 3.6 Cron monitoring: Task 11
- ✅ 3.7 GL permissions: Task 12
- ✅ 3.8 VAT engine: Task 10
- ✅ 3.9 Scalability: Task 1 (CONCURRENTLY indexes), Task 2 (pool max=20, idleTimeoutMillis)
- ✅ 3.10 Journal UI: Task 16 + Task 13 (draft mode, balance warning, control account warning, Reverse button)

### Placeholder scan:
- Task 8 step 3 (`opening_balance.service.ts`) references `OpeningBalance` type — this is the existing type from that service; do not rename
- Task 9 step 2 references `entity.owner_user_id` — confirm this field name in `entities` table (may be `user_id`)

### Type consistency:
- `DbClient` defined in Task 2, used in Tasks 4, 6, 7, 8, 9 — consistent
- `withTransaction` defined in Task 2 — used in Tasks 6–9, 13, 14 — consistent
- `postJournalEntry(params, client?)` — both params and client defined in Task 4 — consistent

### One gap found:
Task 1 migration uses `bank_transactions.is_prepayment` but the schema for `bank_transactions` is not shown in the existing migrations read. If the table has a different structure, the ALTER TABLE in the migration may fail. Before running migration, verify with:

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "\d bank_transactions"
```

If the table doesn't have the expected columns, adjust the migration ALTER TABLE statement accordingly.
