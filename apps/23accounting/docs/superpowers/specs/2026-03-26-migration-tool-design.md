# Migration Tool — Xero & QuickBooks Import

**Date:** 2026-03-26
**Scope:** 22accounting — new `/dashboard/migrate` page + parser services
**Priority:** 4

---

## Objective

Allow businesses to leave Xero or QuickBooks and move their financial data into Relentify without manual data entry. The user exports files from their old platform and uploads them. Relentify guides them through mapping, validates the data, and commits the import.

---

## Supported Sources

| Platform | Export format | What users export |
|----------|--------------|-------------------|
| Xero | CSV (multiple files) | Chart of Accounts, Contacts, Invoices, Bills, Manual Journals |
| QuickBooks | IIF or CSV | Chart of Accounts, Customer List, Vendor List, Invoices, Bills |

Both platforms allow CSV export from their settings. No OAuth, no API credentials needed from the user.

---

## Migration Wizard — 6 Steps

The wizard lives at `/dashboard/migrate`. Each step is a separate view within the page (no full-page navigations). State is held in React context for the duration of the session and persisted to `localStorage` for 24 hours so the user can resume after navigating away.

### Step 1: Choose Source

Two cards: **Xero** and **QuickBooks Desktop/Online**.
- User selects their source platform
- Brief instruction appears: "In Xero, go to Reports → Export → Download these files: ..."
- Downloadable instruction PDF per platform (static file hosted in public/)

### Step 2: Set Cutoff Date

User picks a date — typically their last year-end or last month-end.

**Rules:**
- All outstanding invoices/bills with a date **up to and including** this date will be imported as open items
- Opening balances will reflect account balances at this date
- Transactions before this date are not imported (only the resulting balances)
- A "Preview balances as of cutoff" panel shows before proceeding — account-by-account summary of what will be imported as opening balances

The cutoff date is stored in migration context and used throughout all subsequent steps.

### Step 3: Upload Files

Drag-and-drop or file picker. Multiple files accepted simultaneously.

**Xero — expected files:**
- `Chart of Accounts.csv`
- `Contacts.csv` (customers + suppliers combined)
- `Invoices.csv`
- `Bills.csv` (optional)
- `Manual Journals.csv` (optional)
- `Trial Balance.csv` (for opening balance validation)

**QuickBooks — expected files:**
- `chart_of_accounts.csv` or `.iif`
- `customer_list.csv`
- `vendor_list.csv`
- `invoice_list.csv`
- `bill_list.csv` (optional)
- `trial_balance.csv` (for validation)

**Parsing approach:** Files are parsed in-browser using Papa Parse for CSV. No file is uploaded to the server at this stage — all parsing happens client-side for speed and privacy.

**Large file handling:** Files over 5MB are parsed via a Web Worker to avoid blocking the main thread. Progress is reported back to the UI. If the Web Worker approach fails (browser compatibility edge case), parsing falls back to chunked synchronous processing. For very large exports (>20MB total), a banner offers a server-side fallback: files are uploaded to a temporary presigned R2 URL and parsed server-side, returning the normalised `MigrationData` JSON to the client.

### Step 4: Map Accounts

A two-column mapping UI:
- **Left column:** source accounts (from uploaded COA file)
- **Right column:** Relentify account (dropdown from live COA)

**Auto-matching logic** suggests mappings based on (in priority order):
1. Exact name match
2. Account code match
3. Fuzzy name match (Levenshtein distance ≤ 2 characters difference)
4. Account type match (ASSET → ASSET range, INCOME → 4000–4999, etc.)

**Confidence levels:**
- **High confidence** (exact name or code match): pre-selected silently
- **Medium confidence** (fuzzy match or type match): pre-selected but flagged amber with "Suggested match — please verify"
- **No match**: shown as unresolved (amber), must be manually mapped before proceeding

User reviews and overrides any suggested mappings. A "Skip" option is available for accounts with zero balance and no outstanding items.

### Step 5: Preview & Validate

Before committing anything to the database, show a summary:

```
Will import:
  ✓ 48 accounts (chart of accounts)
  ✓ 127 customers
  ✓ 34 suppliers
  ✓ 89 outstanding invoices (total: £142,380)
  ✓ 23 outstanding bills (total: £31,200)
  ✓ Opening balances as of 31 Dec 2024

Validation:
  ✓ Trial balance: Debits £892,400 = Credits £892,400
  ⚠ 3 invoices have no customer match — will create new customers
  ⚠ 1 account could not be auto-mapped — please review
```

**Trial balance validation:** Sum all debit balances from the uploaded trial balance CSV. Sum all credit balances. If they do not match within £0.01, block import and show the discrepancy.

**Warnings vs errors:**
- Warnings (amber): import will proceed, user acknowledges
- Errors (red): import blocked until resolved

### Step 6: Confirm & Import

"Import [X] records" button. On click:
- Show progress indicator per data type: `accounts → customers → suppliers → invoices → bills → opening balances`
- Progress shown as live counts: `23/89 invoices imported` with an estimated time remaining based on elapsed rate
- Each data type is committed as a batch within a DB transaction
- If any batch fails, that batch rolls back; batches already committed remain (partial import is acceptable)
- Wizard shows which batches succeeded and which failed
- Failed batches show a **"Resume import"** button that replays only the failed batch without reprocessing successful ones (uses the persisted `MigrationData` from `localStorage`)
- On full completion: summary of what was imported + downloadable import report (CSV listing every record created), link to dashboard

---

## Parser Architecture

Two dedicated parser services, one per platform. Both output the same normalised format consumed by the import layer. The shared `MigrationSource` interface makes future sources (Sage, FreeAgent) trivial to add.

### Parser Interface (extensible)

```ts
// src/lib/migration/types.ts

interface MigrationSource {
  parse(files: File[]): Promise<MigrationData>;
}

interface MigrationData {
  accounts:        NormalisedAccount[];
  customers:       NormalisedContact[];
  suppliers:       NormalisedContact[];
  invoices:        NormalisedInvoice[];
  bills:           NormalisedBill[];
  openingBalances: NormalisedBalance[];
  trialBalance:    NormalisedTrialBalance;
}
```

Both `XeroParser` and `QuickBooksParser` implement `MigrationSource`. Adding Sage requires only a new class implementing this interface — no changes to wizard or import layer.

### `src/lib/migration/xero.parser.ts`

Parses Xero's CSV exports. Key mappings:
- `Chart of Accounts.csv`: AccountCode, Name, Type, TaxType → NormalisedAccount
- `Contacts.csv`: ContactName, IsCustomer, IsSupplier, Email, Phone → split into customers/suppliers
- `Invoices.csv`: InvoiceNumber, ContactName, InvoiceDate, DueDate, UnitAmount, TaxAmount, Status → NormalisedInvoice (filter Status = AUTHORISED or OUTSTANDING, date ≤ cutoff)
- `Trial Balance.csv`: AccountCode, Debit, Credit → NormalisedTrialBalance

### `src/lib/migration/quickbooks.parser.ts`

Parses QuickBooks IIF and CSV exports.

**IIF parsing rules:**
- Tab-delimited; detect record type from `!` prefix rows: `!ACCNT`, `!CUST`, `!VEND`, `!TRNS`, `!SPL`
- Column headers are defined by the `!` row immediately preceding the data rows — do not assume fixed column positions
- Unknown row types (not in the expected set) are silently skipped with a count logged to import audit
- Each data row is validated against its header row: missing required columns produce a named validation error, not a crash

QuickBooks account types to Relentify ranges:
| QB Type | Relentify range |
|---------|----------------|
| Bank | 1200–1299 |
| Accounts Receivable | 1100 |
| Other Current Asset | 1000–1099 |
| Accounts Payable | 2100 |
| Credit Card | 2200–2299 |
| Income | 4000–4999 |
| Cost of Goods Sold | 5000–6999 |
| Expense | 7000–9998 |

### `src/lib/migration/import.service.ts`

Consumes `MigrationData` and calls existing services:
- `chart_of_accounts.service.ts` → `createAccount()`
- `customer.service.ts` → `createCustomer()`
- `supplier.service.ts` → `createSupplier()`
- `invoice.service.ts` → `createInvoice()` (with GL posting disabled during migration — opening balances handle the GL side)
- `bill.service.ts` → `createBill()`
- `opening_balance.service.ts` → `importOpeningBalances()` (posts the trial balance figures as the GL state at cutoff date)

**GL strategy during migration:** Individual invoice/bill records are created without posting individual GL entries (to avoid double-counting). The trial balance is imported as a single set of opening balance journal entries. This correctly represents the financial position at cutoff without creating phantom transactions.

**Atomicity guarantee:** If GL posting of opening balances fails, the entire import transaction rolls back. A partial import (records created but no GL entries) must never be committed — it would leave an inconsistent state.

---

## Import Audit Log

Every migration run creates a structured log stored in a new `migration_runs` table:

```sql
CREATE TABLE migration_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     UUID NOT NULL REFERENCES entities(id),
  user_id       UUID NOT NULL,
  source        TEXT NOT NULL,  -- 'xero' | 'quickbooks'
  cutoff_date   DATE NOT NULL,
  files_uploaded JSONB NOT NULL, -- [{name, size, type}]
  auto_mappings  JSONB NOT NULL, -- [{sourceCode, targetCode, confidence}]
  validation_warnings JSONB,
  batches        JSONB NOT NULL, -- [{type, status, count, error?}]
  import_report  TEXT,           -- CSV content of imported records
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

This log is queryable by support to diagnose failed imports. It is also used by the "Resume import" feature to replay only failed batches.

---

## Server-Side Security

The `app/api/migration/import/route.ts` endpoint performs full server-side validation before committing any data to the database:

- **Type validation:** every field in every `NormalisedAccount`, `NormalisedContact`, `NormalisedInvoice`, `NormalisedBill` is checked against expected types and ranges
- **SQL injection prevention:** all DB writes go through parameterised queries via existing service layer — no raw string interpolation
- **Input sanitisation:** string fields trimmed and stripped of null bytes; numeric fields parsed with `parseFloat` and validated as finite numbers
- **Rollback safety:** import route wraps all batch inserts in a single transaction with an explicit `ROLLBACK` on any error; the response will never indicate success unless the transaction committed

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| File format not recognised | Step 3: red error, list expected files |
| Unknown IIF row type | Skip row, increment unknown-row counter, surface total in validation summary |
| Trial balance does not balance | Step 5: blocked, show discrepancy amount |
| Duplicate customer name | Auto-merge: use existing customer record |
| Account code already exists | Auto-merge: map to existing account |
| Invoice references unknown customer | Create customer from invoice data, warn user |
| Import batch fails mid-way | Show which batches succeeded, offer "Resume import" for failed batch |
| User navigates away mid-wizard | Session state preserved in localStorage for 24h |
| Large file (>5MB) | Parse via Web Worker with progress indicator |
| Very large export (>20MB total) | Offer server-side parsing fallback |

---

## Testing

**Unit tests — `src/lib/migration/__tests__/`:**
- `xero.parser.test.ts`: valid Xero CSVs, missing columns, extra whitespace, duplicate contacts, invoices outside cutoff range
- `quickbooks.parser.test.ts`: valid IIF (older and newer formats), valid CSV, unknown row types, missing header rows, malformed numeric fields
- `validation.test.ts`: balanced trial balance, unbalanced trial balance (within/outside tolerance), empty dataset

**End-to-end tests — `playwright/scripts/migrate-xero.ts` and `migrate-quickbooks.ts`:**
- Upload sample export files → complete wizard → verify trial balance matches → verify GL entries created → verify records imported correctly
- Runs against staging as part of CI validation suite

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/dashboard/migrate/page.tsx` | New: 6-step wizard page |
| `src/lib/migration/types.ts` | New: `MigrationSource` interface + all normalised types |
| `src/lib/migration/xero.parser.ts` | New: Xero CSV parser |
| `src/lib/migration/quickbooks.parser.ts` | New: QuickBooks IIF/CSV parser |
| `src/lib/migration/import.service.ts` | New: normalised data → Relentify records |
| `src/lib/migration/validation.ts` | New: trial balance checker, warning/error classifier |
| `src/lib/migration/worker.ts` | New: Web Worker for large file parsing |
| `app/api/migration/validate/route.ts` | New: server-side validation endpoint |
| `app/api/migration/import/route.ts` | New: commit import endpoint (streams progress) |
| `database/migrations/026_migration_runs.sql` | New: `migration_runs` audit table |
| `public/migration-guides/xero-export.pdf` | New: static instruction guide |
| `public/migration-guides/quickbooks-export.pdf` | New: static instruction guide |
| `app/dashboard/layout.tsx` | Add "Migrate" link to sidebar (under Settings group) |
