# Accounting Engine — Find, Fix, Extend

**Date:** 2026-03-26
**Scope:** 22accounting (`src/lib/general_ledger.service.ts` and all posting services)
**Priority:** 1 — implement before all other workstreams

---

## Current State

The accounting engine is built on solid foundations:
- Double-entry GL via `postJournalEntry()` in `general_ledger.service.ts`
- Journal tables: `journal_entries`, `journal_lines`, `chart_of_accounts`
- Period locks enforced at route level (403 on locked periods)
- Real-time P&L, balance sheet, trial balance computed from GL
- Manual journal entries supported via `/dashboard/journals`

**Account ranges:** ASSET 1000–1999 | LIABILITY 2000–2999 | EQUITY 3000–3999 | INCOME 4000–4999 | COGS 5000–6999 | EXPENSE 7000–9998 | SUSPENSE 9999

---

## Phase 1: Fix (Critical)

### 1.1 GL Posting Must Be Blocking

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

### 1.2 GL Integrity Diagnostic

Add a `/api/reports/health` check that counts records with no matching GL entry. Expose in the existing health report. This catches any pre-fix data corruption.

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

**Output:** Audit findings document listing any discrepancies found, with specific line references.

---

## Phase 3: Extend

### 3.1 Accrual Journals

Allow posting a journal entry dated in the future with an automatic reversing entry on the first day of the following period.

**Data model additions:**
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

When a user pays a bill or invoice before the service period, the amount should sit in a prepayment asset account (1300) until the period it relates to.

**Approach:**
- Add "Mark as prepayment" option when recording a bill payment
- On marking: post Dr Prepayments (1300) / Cr Bank instead of directly to the expense account
- Add prepayment schedule: user sets the expense account and number of months
- Cron (`/api/cron/prepayment-release`) releases one month's portion each month: Dr Expense / Cr Prepayments (1300)

**New COA account seeded:** 1300 Prepayments (ASSET)

### 3.3 Adjustment Journal UI Improvements

Manual journals already exist but the UI is minimal. Extend:
- Warn if the journal does not balance before saving (client-side validation)
- Show running Dr/Cr totals as lines are added
- Allow saving as draft (status: `draft`) and posting separately
- Add "Reverse this journal" button on posted journals

### 3.4 VAT Edge Cases

Review and verify correct handling of:
- Partially exempt supplies (mixed input VAT recovery)
- VAT on imports (reverse charge mechanism)
- Zero-rated vs exempt distinction in the 9-box VAT return
- Correct period assignment when invoice date ≠ VAT period

### 3.5 Scalability Improvements

**Database indexes to add:**
```sql
CREATE INDEX CONCURRENTLY idx_journal_lines_entity_date
  ON journal_lines(entity_id, date);

CREATE INDEX CONCURRENTLY idx_journal_lines_account
  ON journal_lines(account_id, entity_id);

CREATE INDEX CONCURRENTLY idx_journal_entries_source
  ON journal_entries(source_type, source_id);

CREATE INDEX CONCURRENTLY idx_invoices_entity_status
  ON invoices(entity_id, status, due_date);
```

**Connection pooling:** Review `src/lib/db.ts` pool settings. At 100+ concurrent users, ensure `max` pool size is appropriate (currently likely default 10 — raise to 20 for small_business tier instances).

**Report query review:** P&L and balance sheet run full GL scans. For entities with 2+ years of data, add date-range filtering at the GL query level (not post-query filtering).

---

## Testing Approach

- Unit tests for each posting service: verify every call to `postJournalEntry` has balanced lines
- Integration test: create invoice → verify GL entry exists → rollback DB → verify invoice does not exist
- GL integrity check: run `/api/diagnostics/gl-integrity` after each test suite — must return 0 mismatches
- Accrual cron: seed an accrual dated yesterday, run cron, verify reversal entry created

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/general_ledger.service.ts` | Accept optional `client` param, expose transaction helper |
| `src/lib/invoice.service.ts` | Wrap in transaction, remove try/catch around GL |
| `src/lib/bill.service.ts` | Wrap in transaction |
| `src/lib/credit_note.service.ts` | Wrap in transaction |
| `src/lib/expense.service.ts` | Wrap in transaction |
| `src/lib/quote.service.ts` | Wrap in transaction (convert path) |
| `src/lib/purchase_order.service.ts` | Wrap in transaction (approve path) |
| `src/lib/opening_balance.service.ts` | Wrap in transaction |
| `src/lib/intercompany.service.ts` | Wrap in transaction |
| `app/api/cron/accrual-reversals/route.ts` | New: daily accrual reversal cron |
| `app/api/cron/prepayment-release/route.ts` | New: monthly prepayment release cron |
| `database/migrations/025_accruals_prepayments.sql` | New: schema additions |
| `app/dashboard/journals/new/page.tsx` | Balance validation, draft mode, reverse button |
