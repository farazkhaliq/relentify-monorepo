# Opening Balances & Year-End Close Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to import opening account balances via Excel and run a manual year-end close that zeros P&L into Retained Earnings and auto-locks the period.

**Architecture:** Opening balances posts a single journal entry (`source_type='opening_balance'`) via the existing `postJournalEntry()`. Year-end close queries P&L account balances, posts a closing journal (`source_type='year_end_close'`), updates `last_fy_end_date` on the entity, and sets `locked_through_date = MAX(year_end_date, current locked_through_date)`. Retained earnings carry-forward is automatic — once P&L is zeroed into account 3001, the balance sheet accumulates it.

**Tech Stack:** Next.js 14 App Router, TypeScript, Postgres (`lib/db.ts` query wrapper), SheetJS (`xlsx` — already installed), existing `postJournalEntry()` from `lib/services/general_ledger.service.ts`.

---

## Key Files Reference

- `lib/services/general_ledger.service.ts` — `postJournalEntry()`, `getTrialBalance()`, `getProfitAndLoss()`
- `lib/services/chart_of_accounts.service.ts` — `getAccountByCode()`, seed array (3001 = Retained Earnings)
- `lib/services/entity.service.ts` — entity CRUD; `getActiveEntity(userId)` used in all routes
- `lib/services/period_lock.service.ts` — `lockPeriod()`, current `locked_through_date` logic
- `lib/auth.ts` — `getAuthUser()` returns `{ userId, actorId, email }` — no entity_id/tier
- `lib/tiers.ts` — feature gating; `canAccess(tier, feature)` is the only way to gate
- `app/dashboard/import/page.tsx` — existing import page with tab UI
- `app/api/import/route.ts` — existing import API (multipart, uses `xlsx`)
- `app/dashboard/settings/SettingsForm.tsx` — settings tabs incl. Period Locks section
- `app/api/period-locks/route.ts` — existing period lock API (reference for pattern)

---

## Task 1: Migration 018 — add `last_fy_end_date` to entities

**Files:**
- Create: `database/migrations/018_fy_end_date.sql`

**Step 1: Write the migration**

```sql
-- 018_fy_end_date.sql
-- Adds last financial year end date to entities.
-- Nullable: null = no year-end close has ever been run for this entity.
-- Updated each time year-end close is confirmed.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS last_fy_end_date DATE;
```

**Step 2: Apply the migration**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -f /dev/stdin < /opt/relentify-accounts/database/migrations/018_fy_end_date.sql
```

Expected: `ALTER TABLE` with no errors.

**Step 3: Verify**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "\d entities" | grep last_fy
```

Expected: `last_fy_end_date | date | ...`

**Step 4: Commit**

```bash
cd /opt/relentify-accounts
git add database/migrations/018_fy_end_date.sql
git commit -m "feat: migration 018 — add last_fy_end_date to entities"
```

---

## Task 2: Add feature keys to `lib/tiers.ts`

**Files:**
- Modify: `lib/tiers.ts`

**Step 1: Locate the Feature type and access map**

Open `lib/tiers.ts`. Find the `Feature` type (union of string literals around line 35–45) and the `ACCESS` map below it.

**Step 2: Add two feature keys to the Feature type**

Add to the union (alongside existing entries like `'excel_import'`):
```typescript
| 'opening_balances'
| 'year_end_close'
```

**Step 3: Add access rules to the ACCESS map**

Add alongside existing entries (both gated at `sole_trader` and above):
```typescript
opening_balances: ['sole_trader', 'small_business', 'medium_business', 'corporate'],
year_end_close:   ['sole_trader', 'small_business', 'medium_business', 'corporate'],
```

**Step 4: Verify no TypeScript errors**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to tiers.ts.

**Step 5: Commit**

```bash
git add lib/tiers.ts
git commit -m "feat: add opening_balances and year_end_close feature keys to tiers"
```

---

## Task 3: Opening balances service

**Files:**
- Create: `lib/services/opening_balance.service.ts`

**Step 1: Write the service**

```typescript
// lib/services/opening_balance.service.ts
import { query } from '../db';
import { getAccountByCode, getChartOfAccounts } from './chart_of_accounts.service';
import { postJournalEntry } from './general_ledger.service';

export interface OpeningBalanceLine {
  accountCode: number;
  debit: number;
  credit: number;
}

export interface ImportOpeningBalancesResult {
  journalEntryId: string;
  linesImported: number;
  suspenseAmount: number; // > 0 if imbalance was auto-posted to 9999
}

/** Check if an opening balance entry already exists for this entity */
export async function getExistingOpeningBalanceEntry(entityId: string) {
  const r = await query(
    `SELECT id, entry_date FROM journal_entries
     WHERE entity_id = $1 AND source_type = 'opening_balance'
     ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  );
  return r.rows[0] ?? null;
}

/** Void an existing opening balance entry by reversing it */
export async function voidOpeningBalanceEntry(entryId: string, userId: string) {
  // Fetch entry
  const entryRes = await query('SELECT * FROM journal_entries WHERE id=$1', [entryId]);
  const entry = entryRes.rows[0];
  if (!entry) throw new Error('Opening balance entry not found');

  const linesRes = await query('SELECT * FROM journal_lines WHERE entry_id=$1', [entryId]);

  // Post reversal
  const reversedLines = linesRes.rows.map((l: any) => ({
    accountId: l.account_id,
    description: `Void opening balance`,
    debit: parseFloat(l.credit),
    credit: parseFloat(l.debit),
  }));

  await postJournalEntry({
    entityId: entry.entity_id,
    userId,
    date: entry.entry_date,
    reference: 'VOID-OB',
    description: 'Void of opening balance entry',
    sourceType: 'opening_balance',
    sourceId: entryId,
    lines: reversedLines,
  });
}

/** Post opening balance lines as a single journal entry */
export async function importOpeningBalances(
  entityId: string,
  userId: string,
  asOfDate: string,        // YYYY-MM-DD
  lines: OpeningBalanceLine[]
): Promise<ImportOpeningBalancesResult> {
  // Resolve account IDs
  const resolvedLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  for (const line of lines) {
    if (line.debit === 0 && line.credit === 0) continue; // skip zeroes

    const acct = await getAccountByCode(entityId, line.accountCode);
    if (!acct) throw new Error(`Account code ${line.accountCode} not found in your chart of accounts`);

    resolvedLines.push({
      accountId: acct.id,
      debit: line.debit,
      credit: line.credit,
      description: `Opening balance — ${acct.name}`,
    });
  }

  if (resolvedLines.length === 0) throw new Error('No non-zero lines found in upload');

  // Check balance
  const totalDebit  = resolvedLines.reduce((s, l) => s + l.debit,  0);
  const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);
  const diff = parseFloat((totalDebit - totalCredit).toFixed(2));

  let suspenseAmount = 0;
  if (Math.abs(diff) > 0.005) {
    // Auto-balance via suspense 9999
    const suspense = await getAccountByCode(entityId, 9999);
    if (!suspense) throw new Error('Suspense account (9999) not found — run COA seed');

    suspenseAmount = Math.abs(diff);
    if (diff > 0) {
      // Debits exceed credits → credit suspense
      resolvedLines.push({ accountId: suspense.id, debit: 0, credit: diff, description: 'Opening balance suspense' });
    } else {
      // Credits exceed debits → debit suspense
      resolvedLines.push({ accountId: suspense.id, debit: Math.abs(diff), credit: 0, description: 'Opening balance suspense' });
    }
  }

  const journalEntryId = await postJournalEntry({
    entityId,
    userId,
    date: asOfDate,
    reference: 'OB',
    description: 'Opening balances',
    sourceType: 'opening_balance',
    lines: resolvedLines,
  });

  return { journalEntryId, linesImported: resolvedLines.length, suspenseAmount };
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 3: Commit**

```bash
git add lib/services/opening_balance.service.ts
git commit -m "feat: opening balance service — import, void, check existing"
```

---

## Task 4: Opening balances — template download API

**Files:**
- Create: `app/api/import/opening-balances/template/route.ts`

**Step 1: Write the route**

```typescript
// app/api/import/opening-balances/template/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { getChartOfAccounts } from '@/lib/services/chart_of_accounts.service';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'opening_balances')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    // Fetch all active COA accounts for this entity
    const accounts = await getChartOfAccounts(entity.id);
    const active = accounts.filter((a: any) => a.is_active !== false);

    // Build workbook
    const wb = XLSX.utils.book_new();

    // --- Main sheet ---
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Opening Debit (£)', 'Opening Credit (£)'];
    const rows = active.map((a: any) => [
      a.code,
      a.name,
      a.account_type,
      '',  // user fills in
      '',  // user fills in
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 14 },  // Account Code
      { wch: 36 },  // Account Name
      { wch: 16 },  // Account Type
      { wch: 20 },  // Opening Debit
      { wch: 20 },  // Opening Credit
    ];

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Format number columns D and E with thousands separator (rows 2+)
    const numFmt = '#,##0.00';
    for (let i = 1; i <= active.length; i++) {
      const rowIdx = i + 1; // 1-indexed, row 1 is header
      const dCell = `D${rowIdx}`;
      const eCell = `E${rowIdx}`;
      if (!ws[dCell]) ws[dCell] = { t: 'n', v: 0 };
      if (!ws[eCell]) ws[eCell] = { t: 'n', v: 0 };
      ws[dCell].z = numFmt;
      ws[eCell].z = numFmt;
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Opening Balances');

    // --- Instructions sheet ---
    const instructions = [
      ['Opening Balances Import — Instructions'],
      [''],
      ['1. Fill in "Opening Debit (£)" or "Opening Credit (£)" for each account that has a balance.'],
      ['2. Leave both columns blank (or as 0) for accounts with no opening balance.'],
      ['3. The "Account Code" and "Account Name" columns are for reference only — do not edit them.'],
      ['4. Do not add or remove rows.'],
      ['5. If your debits and credits do not balance, the difference will be posted to Suspense (9999) automatically.'],
      ['6. Tip: export your Trial Balance from your old system and use it to fill in the figures.'],
      [''],
      ['Common opening balances to include:'],
      ['  - Bank account balance (e.g. account 1200)'],
      ['  - Debtors outstanding (account 1100)'],
      ['  - Creditors outstanding (account 2100)'],
      ['  - VAT owed/owing (accounts 2202, 1201)'],
      ['  - Retained earnings to date (account 3001)'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
    wsInstr['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

    // Write to buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="opening-balances-template.xlsx"',
      },
    });
  } catch (err) {
    console.error('[opening-balances/template]', err);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add app/api/import/opening-balances/template/route.ts
git commit -m "feat: opening balances template download endpoint"
```

---

## Task 5: Opening balances — upload API

**Files:**
- Create: `app/api/import/opening-balances/route.ts`

**Step 1: Write the route**

```typescript
// app/api/import/opening-balances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { logAudit } from '@/lib/services/audit.service';
import {
  getExistingOpeningBalanceEntry,
  voidOpeningBalanceEntry,
  importOpeningBalances,
} from '@/lib/services/opening_balance.service';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

function numVal(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'opening_balances')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const asOfDate = formData.get('asOfDate') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return NextResponse.json({ error: 'Invalid or missing asOfDate (expected YYYY-MM-DD)' }, { status: 400 });
    }

    // Parse file
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or could not be parsed' }, { status: 400 });
    }

    // Map rows — support both template column names and plain CSV headers
    const lines = rows.map((row: any) => ({
      accountCode: parseInt(
        String(row['Account Code'] ?? row['account_code'] ?? row['Code'] ?? '').trim(),
        10
      ),
      debit:  numVal(row['Opening Debit (£)']  ?? row['opening_debit']  ?? row['Debit']  ?? ''),
      credit: numVal(row['Opening Credit (£)'] ?? row['opening_credit'] ?? row['Credit'] ?? ''),
    })).filter(l => !isNaN(l.accountCode) && l.accountCode > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: 'No valid account rows found. Check column headers match the template.' }, { status: 400 });
    }

    // Check if existing opening balance entry — client must pass confirmReplace=true to overwrite
    const existing = await getExistingOpeningBalanceEntry(entity.id);
    const confirmReplace = formData.get('confirmReplace') === 'true';

    if (existing && !confirmReplace) {
      return NextResponse.json({
        error: 'EXISTING_OPENING_BALANCE',
        existingDate: existing.entry_date,
        existingId: existing.id,
      }, { status: 409 });
    }

    if (existing && confirmReplace) {
      await voidOpeningBalanceEntry(existing.id, auth.userId);
    }

    const result = await importOpeningBalances(entity.id, auth.userId, asOfDate, lines);

    await logAudit(auth.userId, 'import_opening_balances', 'entity', entity.id, {
      asOfDate,
      linesImported: result.linesImported,
      suspenseAmount: result.suspenseAmount,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[import/opening-balances]', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add app/api/import/opening-balances/route.ts
git commit -m "feat: opening balances upload API"
```

---

## Task 6: Opening balances — UI tab in import page

**Files:**
- Modify: `app/dashboard/import/page.tsx`

**Step 1: Understand current structure**

The import page has a `type ImportType` union, a `TYPES` array for the tab list, and renders a single upload panel based on `activeType`. We add a new tab type `'opening_balances'` that renders a custom panel (date picker + download template + upload).

**Step 2: Add the new tab type and state**

At the top of `page.tsx`, extend the union:
```typescript
type ImportType = 'customers' | 'suppliers' | 'invoices' | 'bills' | 'expenses' | 'opening_balances';
```

Add a new entry to the `TYPES` array:
```typescript
{
  key: 'opening_balances',
  label: 'Opening Balances',
  description: 'Import account opening balances when migrating from another system.',
  requiredColumns: [],
},
```

Add state variables (inside the component, alongside existing state):
```typescript
const [obAsOfDate, setObAsOfDate] = useState('');
const [obConfirmReplace, setObConfirmReplace] = useState(false);
const [obExisting, setObExisting] = useState<{ existingDate: string; existingId: string } | null>(null);
```

**Step 3: Add the custom panel render**

In the JSX, locate where the upload panel is rendered (after the tab list). Before the existing generic panel, add a conditional block:

```tsx
{activeType === 'opening_balances' ? (
  <div className="space-y-6">
    <p className="text-sm text-slate-500 dark:text-slate-400">
      Download the pre-filled Excel template with your chart of accounts, fill in the opening debit/credit for each account, then upload it below.
    </p>

    {/* Step 1: Download template */}
    <div>
      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Step 1 — Download Template</p>
      <a
        href="/api/import/opening-balances/template"
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        download
      >
        Download Excel Template
      </a>
    </div>

    {/* Step 2: Choose as-of date */}
    <div>
      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
        Step 2 — Opening Balances Date *
      </label>
      <input
        type="date"
        value={obAsOfDate}
        onChange={e => setObAsOfDate(e.target.value)}
        className="px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.07] rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
      />
      <p className="text-xs text-slate-400 mt-1">Usually the day before you started using Relentify.</p>
    </div>

    {/* Step 3: Upload */}
    <div>
      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Step 3 — Upload Completed Template</p>
      <input
        type="file"
        accept=".xlsx,.csv"
        ref={fileRef}
        onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setObExisting(null); }}
        className="block text-sm text-slate-500 dark:text-slate-400"
      />
    </div>

    {/* Existing entry warning */}
    {obExisting && (
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-semibold mb-1">Opening balance entry already exists (as of {obExisting.existingDate})</p>
        <p className="mb-3">Uploading will void the existing entry and replace it.</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={obConfirmReplace}
            onChange={e => setObConfirmReplace(e.target.checked)}
            className="rounded"
          />
          <span>Yes, replace the existing opening balance entry</span>
        </label>
      </div>
    )}

    {/* Import button */}
    <button
      disabled={importing || !file || !obAsOfDate || (!!obExisting && !obConfirmReplace)}
      onClick={handleObImport}
      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
    >
      {importing ? 'Importing…' : 'Import Opening Balances'}
    </button>

    {/* Result */}
    {result && (
      <div className={`rounded-xl p-4 text-sm ${result.errors.length === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'}`}>
        {result.errors.length === 0 ? (
          <>
            <p className="font-semibold">✓ {result.imported} lines imported successfully.</p>
            {(result as any).suspenseAmount > 0 && (
              <p className="mt-1 text-amber-700 dark:text-amber-400">⚠ Imbalance of £{(result as any).suspenseAmount.toFixed(2)} posted to Suspense (9999). Review your trial balance.</p>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold mb-2">Import failed:</p>
            {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
          </>
        )}
      </div>
    )}
  </div>
) : (
  /* existing generic upload panel goes here — no changes to it */
  ...
)}
```

**Step 4: Add the `handleObImport` function**

Inside the component, add:
```typescript
async function handleObImport() {
  if (!file || !obAsOfDate) return;
  setImporting(true);
  setResult(null);

  const fd = new FormData();
  fd.append('file', file);
  fd.append('asOfDate', obAsOfDate);
  if (obConfirmReplace) fd.append('confirmReplace', 'true');

  const res = await fetch('/api/import/opening-balances', { method: 'POST', body: fd });
  const data = await res.json();

  if (res.status === 409 && data.error === 'EXISTING_OPENING_BALANCE') {
    setObExisting({ existingDate: data.existingDate, existingId: data.existingId });
    setImporting(false);
    return;
  }

  if (!res.ok) {
    setResult({ imported: 0, errors: [data.error || 'Import failed'], total: 0 });
  } else {
    setResult({ imported: data.linesImported, errors: [], total: data.linesImported });
    // surface suspense amount via result cast
    (setResult as any)({ imported: data.linesImported, errors: [], total: data.linesImported, suspenseAmount: data.suspenseAmount });
  }
  setImporting(false);
}
```

Note: the existing `ImportResult` type only has `imported/errors/total`. Either extend it to include `suspenseAmount?: number` or use a local type — prefer extending the existing interface.

**Step 5: Verify the page compiles and renders**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add app/dashboard/import/page.tsx
git commit -m "feat: opening balances tab in import page"
```

---

## Task 7: Year-end close service

**Files:**
- Create: `lib/services/year_end.service.ts`

**Step 1: Write the service**

```typescript
// lib/services/year_end.service.ts
import { query } from '../db';
import { getAccountByCode } from './chart_of_accounts.service';
import { postJournalEntry } from './general_ledger.service';

export interface YearEndPreviewLine {
  accountCode: number;
  accountName: string;
  accountType: string;
  closingDebit: number;
  closingCredit: number;
}

export interface YearEndPreview {
  yearEndDate: string;
  lines: YearEndPreviewLine[];
  netProfit: number;       // positive = profit, negative = loss
  retainedEarningsCode: number;
}

/** Calculate closing journal lines for a year-end close without posting */
export async function previewYearEndClose(
  entityId: string,
  yearEndDate: string     // YYYY-MM-DD (inclusive last day of FY)
): Promise<YearEndPreview> {
  // Determine FY start: we close ALL P&L balances up to yearEndDate
  // We use the full cumulative balance because each year-end close zeroes them out.
  // The previous year-end lock means prior-period balances are already zeroed.
  const r = await query(
    `SELECT
       coa.code,
       coa.name,
       coa.account_type,
       COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) AS net
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.entry_id
       AND je.entity_id = $1
       AND je.entry_date <= $2
     WHERE coa.entity_id = $1
       AND coa.account_type IN ('INCOME', 'COGS', 'EXPENSE')
     GROUP BY coa.code, coa.name, coa.account_type
     HAVING COALESCE(SUM(jl.debit) - SUM(jl.credit), 0) != 0
     ORDER BY coa.code ASC`,
    [entityId, yearEndDate]
  );

  const lines: YearEndPreviewLine[] = [];
  let netProfit = 0;

  for (const row of r.rows) {
    const net = parseFloat(row.net);
    // INCOME: credit balance (net is negative) — to zero, debit it
    // COGS/EXPENSE: debit balance (net is positive) — to zero, credit it
    if (row.account_type === 'INCOME') {
      // net is negative for income (credits > debits)
      // Closing entry: Dr Income account (abs(net)), Cr Retained Earnings
      const closingDebit = Math.abs(net);
      lines.push({ accountCode: row.code, accountName: row.name, accountType: row.account_type, closingDebit, closingCredit: 0 });
      netProfit += closingDebit;
    } else {
      // COGS or EXPENSE: net is positive (debits > credits)
      // Closing entry: Cr Expense/COGS account (net), Dr Retained Earnings
      lines.push({ accountCode: row.code, accountName: row.name, accountType: row.account_type, closingDebit: 0, closingCredit: net });
      netProfit -= net;
    }
  }

  return { yearEndDate, lines, netProfit, retainedEarningsCode: 3001 };
}

/** Post the year-end close journal and update entity */
export async function runYearEndClose(
  entityId: string,
  userId: string,
  yearEndDate: string     // YYYY-MM-DD
): Promise<{ journalEntryId: string; lockedThroughDate: string; netProfit: number }> {
  const preview = await previewYearEndClose(entityId, yearEndDate);

  const retainedEarnings = await getAccountByCode(entityId, 3001);
  if (!retainedEarnings) throw new Error('Retained Earnings account (3001) not found — run COA seed');

  // Build journal lines
  const journalLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  for (const line of preview.lines) {
    const acct = await getAccountByCode(entityId, line.accountCode);
    if (!acct) throw new Error(`Account ${line.accountCode} not found`);
    journalLines.push({
      accountId: acct.id,
      description: `Year-end close — ${line.accountName}`,
      debit: line.closingDebit,
      credit: line.closingCredit,
    });
  }

  // Retained earnings line (balancing entry)
  const { netProfit } = preview;
  if (netProfit > 0) {
    // Profit: Cr Retained Earnings
    journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings', debit: 0, credit: netProfit });
  } else if (netProfit < 0) {
    // Loss: Dr Retained Earnings
    journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings (loss)', debit: Math.abs(netProfit), credit: 0 });
  } else {
    // Break-even: still need a line to make the entry valid if there are any lines
    // Only needed if journalLines is non-empty
    if (journalLines.length > 0) {
      journalLines.push({ accountId: retainedEarnings.id, description: 'Year-end retained earnings (break-even)', debit: 0, credit: 0 });
    }
  }

  if (journalLines.length < 2) {
    throw new Error('No P&L balances found for this period — nothing to close.');
  }

  const journalEntryId = await postJournalEntry({
    entityId,
    userId,
    date: yearEndDate,
    reference: `YE-${yearEndDate}`,
    description: `Year-end close — ${yearEndDate}`,
    sourceType: 'year_end_close',
    lines: journalLines,
  });

  // Update last_fy_end_date on entity
  await query(
    'UPDATE entities SET last_fy_end_date = $1 WHERE id = $2',
    [yearEndDate, entityId]
  );

  // Auto-lock: MAX(yearEndDate, current locked_through_date)
  const entityRes = await query('SELECT locked_through_date FROM entities WHERE id=$1', [entityId]);
  const currentLock: string | null = entityRes.rows[0]?.locked_through_date ?? null;

  let newLockDate = yearEndDate;
  if (currentLock && currentLock > yearEndDate) {
    newLockDate = currentLock; // don't move lock backwards
  }

  await query(
    'UPDATE entities SET locked_through_date = $1 WHERE id = $2',
    [newLockDate, entityId]
  );

  return { journalEntryId, lockedThroughDate: newLockDate, netProfit };
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add lib/services/year_end.service.ts
git commit -m "feat: year-end close service — preview and run"
```

---

## Task 8: Year-end close API routes

**Files:**
- Create: `app/api/year-end/preview/route.ts`
- Create: `app/api/year-end/close/route.ts`

**Step 1: Write the preview route**

```typescript
// app/api/year-end/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { previewYearEndClose } from '@/lib/services/year_end.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'year_end_close')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const yearEndDate = req.nextUrl.searchParams.get('yearEndDate');
    if (!yearEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(yearEndDate)) {
      return NextResponse.json({ error: 'Missing or invalid yearEndDate' }, { status: 400 });
    }

    const preview = await previewYearEndClose(entity.id, yearEndDate);
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error('[year-end/preview]', err);
    return NextResponse.json({ error: err.message || 'Preview failed' }, { status: 500 });
  }
}
```

**Step 2: Write the close route**

```typescript
// app/api/year-end/close/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { logAudit } from '@/lib/services/audit.service';
import { runYearEndClose } from '@/lib/services/year_end.service';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'year_end_close')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { yearEndDate } = body;

    if (!yearEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(yearEndDate)) {
      return NextResponse.json({ error: 'Missing or invalid yearEndDate' }, { status: 400 });
    }

    const result = await runYearEndClose(entity.id, auth.userId, yearEndDate);

    await logAudit(auth.userId, 'year_end_close', 'entity', entity.id, {
      yearEndDate,
      journalEntryId: result.journalEntryId,
      netProfit: result.netProfit,
      lockedThroughDate: result.lockedThroughDate,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[year-end/close]', err);
    return NextResponse.json({ error: err.message || 'Year-end close failed' }, { status: 500 });
  }
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add app/api/year-end/preview/route.ts app/api/year-end/close/route.ts
git commit -m "feat: year-end close preview and close API routes"
```

---

## Task 9: Settings — year-end close UI section

**Files:**
- Modify: `app/dashboard/settings/SettingsForm.tsx`

**Step 1: Add year-end state variables**

Inside the component, add alongside the existing period lock state:

```typescript
// Year-end close state
const [lastFyEndDate, setLastFyEndDate] = useState<string | null>(user.last_fy_end_date ?? null);
const [yeDate, setYeDate] = useState<string>(() => {
  if (user.last_fy_end_date) {
    // Default: last FY end + 12 months
    const d = new Date(user.last_fy_end_date);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  return '';
});
const [yePreview, setYePreview] = useState<any>(null);
const [yePreviewLoading, setYePreviewLoading] = useState(false);
const [yeConfirmOpen, setYeConfirmOpen] = useState(false);
const [yeLoading, setYeLoading] = useState(false);
const [yeSuccess, setYeSuccess] = useState('');
const [yeError, setYeError] = useState('');
```

Note: `user` in `SettingsForm` is the merged user+entity object passed as a prop. Check `app/dashboard/settings/page.tsx` to confirm `last_fy_end_date` is included when fetching user data, and add it if missing.

**Step 2: Add preview and close handler functions**

```typescript
async function loadYePreview() {
  if (!yeDate) return;
  setYePreviewLoading(true);
  setYeError('');
  const res = await fetch(`/api/year-end/preview?yearEndDate=${yeDate}`);
  const data = await res.json();
  if (!res.ok) { setYeError(data.error || 'Preview failed'); setYePreviewLoading(false); return; }
  setYePreview(data);
  setYeConfirmOpen(true);
  setYePreviewLoading(false);
}

async function confirmYearEndClose() {
  setYeLoading(true);
  setYeError('');
  const res = await fetch('/api/year-end/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yearEndDate: yeDate }),
  });
  const data = await res.json();
  if (!res.ok) { setYeError(data.error || 'Year-end close failed'); setYeLoading(false); return; }
  setYeSuccess(`Year-end closed. Journal entry posted. Period locked through ${data.lockedThroughDate}.`);
  setLastFyEndDate(yeDate);
  setYeConfirmOpen(false);
  setYeLoading(false);
  loadLockData(); // refresh the period lock display above
}
```

**Step 3: Add the UI section inside the `activeTab === 'locks'` panel**

Locate the Period Locks tab panel in the JSX. At the bottom of that panel (after the existing overrides section), add:

```tsx
{/* Year-End Close */}
<div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.07]">
  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Year-End Close</h3>
  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
    Zeros out all P&amp;L accounts into Retained Earnings and locks the period.
    {lastFyEndDate && <> Last closed: <span className="font-semibold">{lastFyEndDate}</span>.</>}
  </p>

  <div className="flex items-end gap-4">
    <div>
      <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
        Year-End Date
      </label>
      <input
        type="date"
        value={yeDate}
        onChange={e => { setYeDate(e.target.value); setYePreview(null); setYeConfirmOpen(false); }}
        className="px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/[0.07] rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
      />
    </div>
    <button
      disabled={!yeDate || yePreviewLoading}
      onClick={loadYePreview}
      className="px-5 py-3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
    >
      {yePreviewLoading ? 'Loading…' : 'Preview Close'}
    </button>
  </div>

  {yeError && <p className="mt-3 text-sm text-red-500">{yeError}</p>}
  {yeSuccess && <p className="mt-3 text-sm text-emerald-500">{yeSuccess}</p>}

  {/* Preview modal */}
  {yeConfirmOpen && yePreview && (
    <div className="mt-6 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-slate-800/40 p-5">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
        Closing Journal Preview — {yePreview.yearEndDate}
      </h4>
      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.07]">
            <th className="pb-2 pr-3">Code</th>
            <th className="pb-2 pr-3">Account</th>
            <th className="pb-2 pr-3 text-right">Debit</th>
            <th className="pb-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {yePreview.lines.map((l: any, i: number) => (
            <tr key={i} className="border-b border-slate-100 dark:border-white/[0.04]">
              <td className="py-1.5 pr-3 text-slate-500 dark:text-slate-400">{l.accountCode}</td>
              <td className="py-1.5 pr-3 text-slate-900 dark:text-white">{l.accountName}</td>
              <td className="py-1.5 pr-3 text-right">{l.closingDebit > 0 ? `£${l.closingDebit.toFixed(2)}` : ''}</td>
              <td className="py-1.5 text-right">{l.closingCredit > 0 ? `£${l.closingCredit.toFixed(2)}` : ''}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="pt-2 pr-3 text-slate-500 dark:text-slate-400">3001</td>
            <td className="pt-2 pr-3 text-slate-900 dark:text-white">Retained Earnings</td>
            <td className="pt-2 pr-3 text-right">{yePreview.netProfit < 0 ? `£${Math.abs(yePreview.netProfit).toFixed(2)}` : ''}</td>
            <td className="pt-2 text-right">{yePreview.netProfit >= 0 ? `£${yePreview.netProfit.toFixed(2)}` : ''}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Net {yePreview.netProfit >= 0 ? 'profit' : 'loss'}: <span className="font-semibold">£{Math.abs(yePreview.netProfit).toFixed(2)}</span>.
        Period will be locked through <span className="font-semibold">{yeDate}</span> (or later if already locked further).
      </p>
      <div className="flex gap-3">
        <button
          disabled={yeLoading}
          onClick={confirmYearEndClose}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {yeLoading ? 'Closing…' : 'Confirm Year-End Close'}
        </button>
        <button
          onClick={() => setYeConfirmOpen(false)}
          className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )}
</div>
```

**Step 4: Ensure `last_fy_end_date` is included in the settings page data**

Open `app/dashboard/settings/page.tsx`. Find where user data is fetched and passed to `SettingsForm`. Ensure the query or API call returns `last_fy_end_date` from `entities`. If the settings page fetches from the entity via a join, this may already be present — verify and add to the SELECT if missing.

**Step 5: Verify TypeScript compiles**

```bash
cd /opt/relentify-accounts
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add app/dashboard/settings/SettingsForm.tsx app/dashboard/settings/page.tsx
git commit -m "feat: year-end close UI in Settings → Period Locks"
```

---

## Task 10: Deploy and verify

**Step 1: Build and deploy**

```bash
cd /opt/relentify-accounts
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs relentify-accounts --tail 50 -f
```

Wait for `ready` log line. Expected: no errors.

**Step 2: Verify migration applied**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='entities' AND column_name='last_fy_end_date';"
```

Expected: 1 row returned.

**Step 3: Test opening balances template download**

In browser (logged in as a `sole_trader`+ user):
1. Navigate to `/dashboard/import`
2. Click "Opening Balances" tab
3. Click "Download Excel Template"
4. Verify `.xlsx` downloads with two sheets: "Opening Balances" (pre-populated with COA) and "Instructions"

**Step 4: Test opening balances upload**

1. Fill in a couple of debit/credit values in the template (ensure they balance)
2. Set an as-of date
3. Click Import — verify success toast and line count
4. Navigate to `/dashboard/reports/general-ledger` — verify the opening balance journal entry appears with `source_type = opening_balance`

**Step 5: Test opening balances replace flow**

1. Try importing again with the same entity
2. Verify the 409 warning UI appears asking for confirmation
3. Check the box and re-import — verify old entry is voided and new entry posted

**Step 6: Test year-end close preview**

1. Navigate to Settings → Period Locks
2. Scroll to Year-End Close section
3. Set a year-end date
4. Click Preview — verify modal shows P&L account closing lines and Retained Earnings line

**Step 7: Test year-end close confirm**

1. Click Confirm — verify success message with journal entry ID and new lock date
2. Navigate to GL and verify the closing journal (`YE-YYYY-MM-DD`) is posted
3. Verify `locked_through_date` updated correctly (should be `MAX(year_end_date, previous_lock)`)
4. Verify `last_fy_end_date` on entity updated (check next visit to the year-end section shows correct default date)

**Step 8: Clean up build cache**

```bash
docker builder prune -f
```

**Step 9: Update CLAUDE.md**

Mark item #35 as ✅ in `CLAUDE.md` checklist and update the summary count (24 done, 24 remaining).

```bash
git add CLAUDE.md
git commit -m "docs: mark #35 opening balances / year-end close as complete"
```
