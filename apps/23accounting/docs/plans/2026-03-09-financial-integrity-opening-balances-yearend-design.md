# Design: Opening Balances & Year-End Close

Date: 2026-03-09
Status: Approved

## Overview

Two related financial integrity features:
1. **Opening balances** — import account opening balances via Excel/CSV when migrating from another system
2. **Year-end close** — manually trigger a year-end closing journal that zeroes P&L accounts into retained earnings and auto-locks the period

Retained earnings carry-forward is implicit: once P&L is closed to account 3200, the next year's balance sheet accumulates it automatically.

---

## Data Model

### Migration 018

Add to `entities` table:
```sql
ALTER TABLE entities ADD COLUMN last_fy_end_date DATE;
```

- Nullable. Null = no year-end close ever run (new company).
- Updated each time a year-end close is confirmed to the date the user chose.
- Used to pre-fill the next year-end date (`last_fy_end_date + 12 months`), fully editable — no 12-month enforcement.

### COA Seed

Ensure account **3200 Retained Earnings** (type: EQUITY) exists for all entities. Year-end close posts net profit/loss here.

---

## Feature 1: Opening Balances

### Where
New "Opening Balances" tab in `/dashboard/import`.

### User Flow
1. User clicks **"Download Template"**
   - Server generates a formatted `.xlsx` using the existing `xlsx` (SheetJS) library
   - Pre-populated with all active COA accounts for their entity (code, name columns filled)
   - Debit and Credit columns empty, formatted with thousands separators
   - Columns: left-aligned text for account code/name, right-aligned numbers for debit/credit
   - Column widths set appropriately (not default narrow)
   - Separate "Instructions" sheet explaining the format and rules
2. User fills in opening debit/credit values and uploads the file
3. User picks an **"as of" date** (typically the day before they started using Relentify)
4. On upload:
   - Validate each row's account code maps to a known COA account for the entity
   - If total debits ≠ total credits, auto-post the difference to suspense account (9999) so the entry always balances — show a warning to the user
   - If an opening balance entry already exists for this entity, warn and ask for confirmation before voiding and replacing
5. Posts a **single journal entry**: `source_type = 'opening_balance'`, dated as of the chosen date

### Accepted formats
`.xlsx` or `.csv`

### API
`POST /api/import/opening-balances`

Request body (multipart form):
- `file` — uploaded `.xlsx` or `.csv`
- `asOfDate` — YYYY-MM-DD

Response: `{ journalEntryId, linesImported, suspenseAmount? }`

---

## Feature 2: Year-End Close

### Where
New section at the bottom of **Settings → Period Locks** tab.

### User Flow
1. Section shows: "Next year end: [last_fy_end_date + 12 months]" with an editable date picker
   - If `last_fy_end_date` is null: shows "Not set" with empty date picker and a prompt to set it
2. User clicks **"Preview Close"**
   - Modal opens showing the proposed closing journal:
     - Every P&L account (INCOME, COGS, EXPENSE) with a non-zero balance for the year, with its closing debit/credit to zero it out
     - Net profit line → Cr Retained Earnings 3200 (or Dr if a loss)
     - Total debits = total credits confirmation line
3. User clicks **"Confirm Year-End Close"**
   - Posts closing journal: `source_type = 'year_end_close'`
   - Updates `entities.last_fy_end_date` to the chosen date
   - Sets `locked_through_date = MAX(chosen_year_end_date, current locked_through_date)` — never moves the lock backward
4. Success state shows the new journal entry ID and updated lock date

### API
`POST /api/year-end/close`

Request body: `{ yearEndDate: string }` (YYYY-MM-DD)

Response: `{ journalEntryId, lockedThroughDate, netProfit }`

### Closing journal mechanics

For each P&L account with a non-zero net balance in the period up to `yearEndDate`:
- INCOME accounts have credit balances (net = credits - debits). Close by debiting them.
- COGS + EXPENSE accounts have debit balances (net = debits - credits). Close by crediting them.
- Net profit (total income − total COGS − total expenses) → credit to 3200 Retained Earnings
- Net loss → debit to 3200 Retained Earnings

The closing journal is `source_type = 'year_end_close'`, `source_id = null`.

---

## Tier Gating

Both features: `sole_trader` and above (uses `canAccess(tier, feature)` from `lib/tiers.ts`).

---

## Out of Scope

- API integration with Xero or QuickBooks (CSV/Excel import is sufficient for v1; API integrations are unreliable and require ongoing maintenance)
- Automatic year-end scheduling
- Multiple opening balance entries per entity per date (warn + replace pattern instead)
