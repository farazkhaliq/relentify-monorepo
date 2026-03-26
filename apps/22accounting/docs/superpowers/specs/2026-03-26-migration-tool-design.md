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

The wizard lives at `/dashboard/migrate`. Each step is a separate view within the page (no full-page navigations). State is held in React context for the duration of the session.

### Step 1: Choose Source

Two cards: **Xero** and **QuickBooks Desktop/Online**.
- User selects their source platform
- Brief instruction appears: "In Xero, go to Reports → Export → Download these files: ..."
- Downloadable instruction PDF per platform (static file hosted in public/)

### Step 2: Set Cutoff Date

User picks a date — typically their last year-end or last month-end.

**Rules:**
- All outstanding invoices/bills as of this date will be imported as open items
- Opening balances will reflect account balances at this date
- Transactions before this date are not imported (only the resulting balances)

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

Files are parsed in-browser (using ExcelJS / Papa Parse for CSV). No file is uploaded to the server at this stage — all parsing happens client-side for speed and privacy.

### Step 4: Map Accounts

A two-column mapping UI:
- **Left column:** source accounts (from uploaded COA file)
- **Right column:** Relentify account (dropdown from live COA)

Auto-matching logic suggests mappings based on:
1. Exact name match
2. Account code match
3. Account type match (ASSET → ASSET range, INCOME → 4000–4999, etc.)

User reviews and overrides any suggested mappings. Unmapped accounts are highlighted in amber — they must be resolved before proceeding. A "Skip" option is available for accounts with zero balance and no outstanding items.

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
- Show progress indicator (per data type: accounts → customers → suppliers → invoices → bills → opening balances)
- Each data type is committed as a batch within a DB transaction
- If any batch fails, that batch rolls back, others already committed remain (partial import is acceptable — the wizard shows which batches succeeded)
- On completion: summary of what was imported, link to dashboard

---

## Parser Architecture

Two dedicated parser services, one per platform. Both output the same normalised format consumed by the import layer.

### Normalised Output Format

```ts
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

### `src/lib/migration/xero.parser.ts`

Parses Xero's CSV exports. Key mappings:
- `Chart of Accounts.csv`: AccountCode, Name, Type, TaxType → NormalisedAccount
- `Contacts.csv`: ContactName, IsCustomer, IsSupplier, Email, Phone → split into customers/suppliers
- `Invoices.csv`: InvoiceNumber, ContactName, InvoiceDate, DueDate, UnitAmount, TaxAmount, Status → NormalisedInvoice (filter Status = AUTHORISED or OUTSTANDING)
- `Trial Balance.csv`: AccountCode, Debit, Credit → NormalisedTrialBalance

### `src/lib/migration/quickbooks.parser.ts`

Parses QuickBooks IIF and CSV exports. Key mappings:
- IIF files: tab-delimited, `!ACCNT` rows for accounts, `!CUST` for customers, `!VEND` for vendors, `!TRNS`/`!SPL` for transactions
- CSV variant: similar column names but comma-delimited

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

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| File format not recognised | Step 3: red error, list expected files |
| Trial balance does not balance | Step 5: blocked, show discrepancy amount |
| Duplicate customer name | Auto-merge: use existing customer record |
| Account code already exists | Auto-merge: map to existing account |
| Invoice references unknown customer | Create customer from invoice data, warn user |
| Import batch fails mid-way | Show which batches succeeded, offer retry for failed batch |
| User navigates away mid-wizard | Session state preserved in localStorage for 24h |

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/dashboard/migrate/page.tsx` | New: 6-step wizard page |
| `src/lib/migration/xero.parser.ts` | New: Xero CSV parser |
| `src/lib/migration/quickbooks.parser.ts` | New: QuickBooks IIF/CSV parser |
| `src/lib/migration/import.service.ts` | New: normalised data → Relentify records |
| `src/lib/migration/validation.ts` | New: trial balance checker, warning/error classifier |
| `app/api/migration/validate/route.ts` | New: server-side validation endpoint |
| `app/api/migration/import/route.ts` | New: commit import endpoint (streams progress) |
| `public/migration-guides/xero-export.pdf` | New: static instruction guide |
| `public/migration-guides/quickbooks-export.pdf` | New: static instruction guide |
| `app/dashboard/layout.tsx` | Add "Migrate" link to sidebar (under Settings group) |
