# Accounting Engine — Find, Fix, Extend

**Date:** 2026-03-26
**Scope:** 22accounting (`src/lib/general_ledger.service.ts` and all posting services)
**Priority:** 1 — implement before all other workstreams

---

## Current State

The accounting engine is built on solid foundations:
- Double-entry GL via `postJournalEntry()` in `general_ledger.service.ts`
- Journal tables: `journal_entries`, `journal_lines`, `chart_of_accounts`
- `journal_entries` has `source_type` + `source_id` fields (indexed, no UNIQUE constraint yet)
- `journal_entries.is_locked` boolean exists but is not enforced
- Period locks implemented in `period_lock.service.ts`, enforced at route level (403 on locked periods)
- `audit_log` table exists (migration 006): `id, user_id, action, entity_type, entity_id, metadata, created_at` — but missing `actor_id` column and GL-specific actions
- Real-time P&L, balance sheet, trial balance computed from GL
- Manual journal entries supported via `/dashboard/journals`

**Account ranges:** ASSET 1000–1999 | LIABILITY 2000–2999 | EQUITY 3000–3999 | INCOME 4000–4999 | COGS 5000–6999 | EXPENSE 7000–9998 | SUSPENSE 9999

---

## Phase 1: Fix (Critical)

### 1.1 GL Posting Must Be Blocking (Atomic Transactions)

**Current behaviour:** GL posting is wrapped in a try/catch. If it fails, the parent record (invoice, bill, expense, etc.) still saves and the error is silently logged to Sentry. This means the DB can have invoices with no GL entries — a data integrity violation.

**Fix:** All parent record creation must be wrapped in a single DB transaction. If `postJournalEntry()` fails, the entire transaction rolls back. No parent record is ever saved without a corresponding GL entry.

**Affected services:**
- `invoice.service.ts` — createInvoice, recordPayment, voidInvoice
- `bill.service.ts` — createBill, recordPayment
- `credit_note.service.ts` — createCreditNote, voidCreditNote
- `expense.service.ts` — createExpense, approveExpense
- `quote.service.ts` — convertToInvoice (triggers invoice creation)
- `purchase_order.service.ts` — approve (triggers bill creation)
- `opening_balance.service.ts` — importOpeningBalances
- `intercompany.service.ts` — createIntercompanyTransaction

**Implementation pattern:**
```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const record = await createRecord(client, data);
  await postJournalEntry(client, { ... });
  await client.query('COMMIT');
  return record;
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

All affected services must accept an optional `client` parameter so they can participate in a parent transaction.

### 1.2 Idempotency Keys

**Problem:** At 500+ users, network retries, timeouts, and double-clicks WILL happen. Without idempotency enforcement, retries create duplicate invoices, duplicate journal entries, and broken financials.

**Current state:** `journal_entries` has `source_type` + `source_id` columns with an index — but no UNIQUE constraint. Duplicate entries for the same source record can and will accumulate.

**Fix:**

```sql
-- Prevent duplicate GL entries for the same source event
ALTER TABLE journal_entries
  ADD CONSTRAINT uq_journal_entry_source
  UNIQUE (entity_id, source_type, source_id);
```

For manual journals and accruals (no source record), `source_type = 'manual'` and `source_id` is the frontend-generated idempotency key (UUID generated on form open, passed with the request).

**API-level idempotency:** Routes that create financial records should accept an optional `Idempotency-Key` header. If the same key is received twice within 24 hours, return the original response without re-processing. Store processed keys in a `idempotency_keys` table with a TTL-style cleanup cron.

```sql
CREATE TABLE idempotency_keys (
  key         TEXT PRIMARY KEY,
  entity_id   UUID NOT NULL,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON idempotency_keys(entity_id, created_at);
```

### 1.3 Period Lock Enforcement at GL Level

**Current behaviour:** Period lock is checked at the route handler level. The `postJournalEntry()` function itself does not check locks. Any internal call (cron, migration, intercompany) bypasses the lock silently.

**Fix:** Add lock check inside `postJournalEntry()`:

```ts
export async function postJournalEntry(client, entry) {
  const locked = await isDateLocked(entry.entityId, entry.date, entry.userId);
  if (locked.locked) {
    throw new Error(`PERIOD_LOCKED: Cannot post to ${entry.date}. Period locked through ${locked.lockedThrough}.`);
  }
  // ... proceed with posting
}
```

The route-level 403 check remains as a user-facing early return. The GL-level check is the enforced safety net that cannot be bypassed.

### 1.4 GL Integrity Diagnostic

Add a check to the existing `/api/reports/health` endpoint that counts:
- Invoices/bills/expenses with no matching GL entry
- Journal entries where sum(debit) ≠ sum(credit)

Expose both counts in the health report. Zero mismatches is the expected state after Phase 1 is complete.

---

## Phase 2: Audit (Find)

Systematically review each posting service against these criteria:

| Check | What to verify |
|-------|---------------|
| Balance | Every `postJournalEntry()` call has lines where sum(debit) = sum(credit) |
| Account codes | Hardcoded account IDs fall within correct range for their type |
| VAT | VAT lines post to correct input/output accounts based on direction |
| Multi-entity | `entity_id` is always scoped correctly, no cross-entity data leak |
| Concurrency | No race conditions on sequential ID generation or balance reads |
| Void/reversal | Voiding creates exact reversal entries, not deletions |
| Immutability | Posted journal entries are never edited, only reversed |
| Control accounts | Invoices always use AR (1100), bills always use AP (2100) — no exceptions |

**Output:** Audit findings document listing any discrepancies found, with specific line references.

---

## Phase 3: Extend

### 3.1 Accrual Journals

Allow posting a journal entry dated in the future with an automatic reversing entry on the first day of the following period.

**Data model additions (migration 025):**
```sql
ALTER TABLE journal_entries ADD COLUMN is_accrual BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_entries ADD COLUMN reversal_date DATE;
ALTER TABLE journal_entries ADD COLUMN reversed_by UUID REFERENCES journal_entries(id);
```

**Behaviour:**
- User creates accrual journal with a reversal date
- Cron job (`/api/cron/accrual-reversals`) runs daily, posts reversal entries for any accruals where `reversal_date = today` and `reversed_by IS NULL`
- Reversal entries are identical to original but with Dr/Cr swapped

### 3.2 Prepayment Tracking

When a user pays a bill before the service period, the amount should sit in a prepayment asset account (1300) until the period it relates to.

**Approach:**
- Add "Mark as prepayment" option when recording a bill payment
- On marking: post Dr Prepayments (1300) / Cr Bank instead of directly to the expense account
- Add prepayment schedule: user sets the expense account and number of months
- Cron (`/api/cron/prepayment-release`) releases one month's portion each month: Dr Expense / Cr Prepayments (1300)

**New COA account seeded:** 1300 Prepayments (ASSET)

### 3.3 Control Account Enforcement

**Current state:** Invoices post to 1100 Debtors (AR) and bills post to 2100 Creditors (AP) by convention in each service. Nothing prevents someone changing these account IDs.

**Fix:** Mark 1100 and 2100 as protected system accounts. Add a `is_control_account` flag:

```sql
ALTER TABLE chart_of_accounts
  ADD COLUMN is_control_account BOOLEAN DEFAULT FALSE,
  ADD COLUMN control_type TEXT; -- 'AR' | 'AP' | NULL
```

Seed: 1100 → `is_control_account=TRUE, control_type='AR'` | 2100 → `is_control_account=TRUE, control_type='AP'`

`postJournalEntry()` validates that any entry with `source_type = 'invoice'` includes a debit to the AR control account. Same for bills and AP. Cannot be overridden. Manual journals cannot post directly to control accounts (show warning in UI, enforce in service).

### 3.4 Journal Immutability

**Current state:** `journal_entries.is_locked` exists but is unused in enforcement.

**Rules to enforce:**
- Posted journal entries: **never editable**. The only correction mechanism is a reversal entry.
- `is_locked` is set to `TRUE` automatically on commit (not a user action).
- Any attempt to UPDATE a journal entry row throws a service-level error, regardless of caller.
- Draft journals (`status = 'draft'`) may be edited freely before posting.

**Data model addition (migration 025):**
```sql
ALTER TABLE journal_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'posted'
  CHECK (status IN ('draft', 'posted'));
```

### 3.5 Audit Trail Completeness

**Current state:** `audit_log` table exists but:
- Missing `actor_id` column (accountant-acting-as-client is not persisted in DB, only accepted in service)
- Missing `workspace_entity_id` — the entity the action was performed within
- GL-specific events (JOURNAL_POSTED, PERIOD_LOCKED, VOID_INVOICE) are not consistently logged

**Fixes (migration 025):**
```sql
ALTER TABLE audit_log
  ADD COLUMN actor_id UUID REFERENCES users(id),       -- accountant's user_id when impersonating
  ADD COLUMN workspace_entity_id UUID REFERENCES entities(id); -- which entity/workspace
```

**GL events to add to `logAudit()` calls:**

| Event | Where to add |
|-------|-------------|
| `JOURNAL_POSTED` | `postJournalEntry()` |
| `JOURNAL_REVERSED` | `reverseJournalEntry()` |
| `PERIOD_LOCKED` | `period_lock.service.ts → lockPeriod()` |
| `PERIOD_UNLOCKED` | `period_lock.service.ts → unlockPeriod()` |
| `OPENING_BALANCES_IMPORTED` | `opening_balance.service.ts` |
| `YEAR_END_CLOSED` | `year_end.service.ts` |
| `INVOICE_VOIDED` | `invoice.service.ts → voidInvoice()` |
| `BILL_VOIDED` | `bill.service.ts → voidBill()` |

### 3.6 Cron Job Monitoring

**Current state:** Cron jobs (PO escalation, reminders, and new accrual/prepayment crons) run silently. If they fail or are missed, there is no alert and no record.

**Fix — `cron_runs` table (migration 025):**
```sql
CREATE TABLE cron_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error       TEXT,
  records_processed INTEGER
);
CREATE INDEX ON cron_runs(job_name, started_at DESC);
```

Every cron route inserts a `running` record on start, updates to `success` or `failed` on completion.

Monitoring query: any job where `status = 'failed'` or where the last `success` run is more than 2× the expected interval sends a Telegram alert (using the existing alert infrastructure from the container monitor).

### 3.7 Permissions for GL Operations

**Current state:** The tier system controls which features are accessible. But within a tier, there is no role differentiation for sensitive GL operations.

**Required permission checks for GL actions:**

| Action | Who can do it |
|--------|--------------|
| Post manual journal | `admin` or `accountant` role only |
| Reverse a journal | `admin` or `accountant` role only |
| Import opening balances | `admin` only |
| Close year-end | `admin` only |
| Lock/unlock period | `admin` or accountant with override |
| Approve expenses/POs | Designated approver (existing logic) |
| View reports | All team members |
| Create invoices/bills | All team members |

**Implementation:** Add a `role` column to `team_members` table (`admin` | `accountant` | `staff`). Check role in the affected service functions — not just at route level. Default for existing team members: `staff`. Entity owner: always `admin`.

### 3.8 VAT Engine (Explicit Rules)

"Review VAT edge cases" is not sufficient. VAT is where accounting products fail. Define explicit engine rules:

**UK VAT handling required:**

| Scenario | Rule |
|----------|------|
| Standard rated (20%) | Dr Debtor gross / Cr Sales net + Cr VAT Output (2202) |
| Zero rated (0%) | Dr Debtor gross / Cr Sales — no VAT line posted |
| Exempt | Dr Debtor gross / Cr Sales — no VAT line, not included in Box 6 |
| Reverse charge (imports) | Dr VAT Input + Dr Expense / Cr VAT Output + Cr Creditor — net effect zero |
| Partially exempt | VAT recovery split — configurable recovery % per entity |
| Invoice date ≠ VAT period | Use invoice date for VAT period assignment (not payment date) |
| Cash accounting scheme | Option per entity — VAT recognised on payment, not invoice |

**VAT engine service:** Extract VAT calculation logic from individual services into a dedicated `vat.service.ts` with explicit functions per scenario. Individual services call the VAT engine rather than duplicating logic.

**9-box validation:** Add a test that generates a known set of transactions and asserts the exact 9-box VAT return values.

### 3.9 Scalability Improvements

**Database indexes to add (migration 025):**
```sql
-- These replace/supplement the existing idx_je_entity_date and idx_jl_entry
CREATE INDEX CONCURRENTLY idx_journal_lines_entity_date
  ON journal_lines(entry_id) INCLUDE (account_id, debit, credit);

CREATE INDEX CONCURRENTLY idx_journal_lines_account_entity
  ON journal_lines(account_id, entry_id);

CREATE INDEX CONCURRENTLY idx_invoices_entity_status
  ON invoices(entity_id, status, due_date);

CREATE INDEX CONCURRENTLY idx_bills_entity_status
  ON bills(entity_id, status, due_date);
```

**Connection pooling:** Review `src/lib/db.ts` pool settings. Raise `max` from default 10 to 20. Add `idleTimeoutMillis: 30000`.

**Report query review:** P&L and balance sheet run full GL scans. Add mandatory date-range filtering at the GL query level. For entities with 2+ years of data, an unbounded scan becomes a serious performance problem.

**Future (not urgent):** Monthly balance snapshots per account as a pre-aggregation layer. Not needed below 5,000 users.

### 3.10 Adjustment Journal UI Improvements

Manual journals already exist but the UI is minimal. Extend:
- Warn if the journal does not balance before saving (client-side validation, live Dr/Cr totals)
- Draft mode: save without posting, post explicitly
- "Reverse this journal" button on posted journals
- Prevent direct posting to control accounts (AR 1100, AP 2100) with clear error message

---

## Testing Approach

- Unit tests for each posting service: verify every `postJournalEntry()` call has balanced lines
- Integration test: create invoice → verify GL entry exists → simulate GL failure → verify invoice does not exist
- Idempotency test: submit same invoice creation twice with same idempotency key → verify single record
- GL integrity check: run `/api/diagnostics/gl-integrity` after each test suite — must return 0 mismatches
- Period lock test: attempt to post to a locked period via internal service call (bypassing route) → verify throws
- Accrual cron: seed accrual dated yesterday, run cron, verify reversal entry created
- VAT 9-box: seed known transactions, assert exact box values

---

## Migration Plan

All schema changes go in `database/migrations/025_accounting_engine.sql`:
- Idempotency: UNIQUE constraint on `journal_entries(entity_id, source_type, source_id)`
- Idempotency keys table
- Accruals: `is_accrual`, `reversal_date`, `reversed_by` on `journal_entries`
- Journal status: `status` column on `journal_entries`
- Prepayments: `is_prepayment` on bill payments
- Control accounts: `is_control_account`, `control_type` on `chart_of_accounts`
- Audit log: `actor_id`, `workspace_entity_id` on `audit_log`
- Cron runs: new `cron_runs` table
- Team member roles: `role` column on `team_members`
- Indexes

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `src/lib/general_ledger.service.ts` | Accept optional `client` param, period lock check inside postJournalEntry, control account validation, logAudit on post/reverse |
| `src/lib/invoice.service.ts` | Atomic transaction, idempotency key check |
| `src/lib/bill.service.ts` | Atomic transaction, idempotency key check |
| `src/lib/credit_note.service.ts` | Atomic transaction |
| `src/lib/expense.service.ts` | Atomic transaction |
| `src/lib/quote.service.ts` | Atomic transaction (convert path) |
| `src/lib/purchase_order.service.ts` | Atomic transaction (approve path) |
| `src/lib/opening_balance.service.ts` | Atomic transaction |
| `src/lib/intercompany.service.ts` | Atomic transaction |
| `src/lib/vat.service.ts` | New: explicit VAT engine with named functions per scenario |
| `src/lib/idempotency.service.ts` | New: check/store idempotency keys |
| `src/lib/cron-monitor.service.ts` | New: record cron runs, alert on failure |
| `src/lib/period_lock.service.ts` | GL-level lock check (already service-level, add to postJournalEntry call) |
| `src/lib/audit.service.ts` | Add actor_id + workspace_entity_id params, persist to new columns |
| `src/lib/team.service.ts` | Add role-based permission check helpers |
| `app/api/cron/accrual-reversals/route.ts` | New: daily accrual reversal cron |
| `app/api/cron/prepayment-release/route.ts` | New: monthly prepayment release cron |
| `database/migrations/025_accounting_engine.sql` | All schema additions described above |
| `app/dashboard/journals/new/page.tsx` | Balance validation, draft mode, reverse button, control account warning |
