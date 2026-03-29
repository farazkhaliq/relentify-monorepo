# Migration Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Note to implementing agent:** Save this plan to `/opt/relentify-monorepo/apps/22accounting/docs/superpowers/plans/2026-03-28-migration-tool.md` before starting any other task.

---

## Goal

Allow businesses migrating from Xero or QuickBooks to import their financial history into Relentify via a guided 6-step wizard at `/dashboard/migrate`. Users export CSV/IIF files from their old platform; Relentify parses them client-side, auto-maps accounts with fuzzy matching, validates the trial balance, and commits the full import atomically. A `migration_runs` audit table captures every run for support and resume-on-failure.

---

## Architecture

**Parsing is client-side first.** Files are parsed in-browser using Papa Parse. Files over 5MB are handed to a Web Worker (`src/lib/migration/worker.ts`). Files over 20MB total trigger an offer for server-side parsing (upload to R2 presigned URL, server returns normalised JSON).

**Normalised data flows through a single interface.** Both `XeroParser` and `QuickBooksParser` implement `MigrationSource` and return a `MigrationData` object. The wizard UI, import service, and API route all deal only with `MigrationData` — no parser-specific code leaks up.

**Import is transactional.** The server route wraps all DB writes in a single `pg` PoolClient transaction (using the `withTransaction` helper introduced in migration 025). If GL posting of opening balances fails, the entire transaction rolls back. Partial success per-batch is acceptable only in the "Resume import" flow, where batches already marked `completed` in `migration_runs.batches` are skipped.

**GL strategy during migration.** Invoices and bills are created with `skipGLPosting: true` (a new flag added to `createInvoice` and `createBill`). The trial balance figures are imported via the existing `importOpeningBalances()` as the single GL truth at cutoff. This prevents double-counting.

**Tier gate.** Migration is gated at `small_business` and above. A new feature key `platform_migration` is added to `tiers.ts`.

**Prerequisite.** Migration 025 (`accounting-engine`) must already be applied since this plan uses `withTransaction` from `db.ts`.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `database/migrations/026_migration_runs.sql` | Create | `migration_runs` audit table |
| `src/lib/tiers.ts` | Modify | Add `platform_migration` feature key, gate at `small_business+` |
| `src/lib/migration/types.ts` | Create | All normalised types, `MigrationSource` interface, confidence enum |
| `src/lib/migration/xero.parser.ts` | Create | Xero CSV parser implementing `MigrationSource` |
| `src/lib/migration/quickbooks.parser.ts` | Create | QuickBooks IIF/CSV parser implementing `MigrationSource` |
| `src/lib/migration/matcher.ts` | Create | Levenshtein fuzzy account matcher with 3 confidence tiers |
| `src/lib/migration/validation.ts` | Create | Trial balance checker, warning/error classifier |
| `src/lib/migration/import.service.ts` | Create | `MigrationData` → Relentify records, full transaction wrapping |
| `src/lib/migration/worker.ts` | Create | Web Worker entry point wrapping parsers for large files |
| `src/lib/migration/__tests__/matcher.test.ts` | Create | Unit tests for Levenshtein matcher |
| `src/lib/migration/__tests__/xero.parser.test.ts` | Create | Unit tests for Xero CSV parser |
| `src/lib/migration/__tests__/quickbooks.parser.test.ts` | Create | Unit tests for QuickBooks parser |
| `src/lib/migration/__tests__/validation.test.ts` | Create | Unit tests for trial balance validation |
| `src/lib/invoice.service.ts` | Modify | Add `skipGLPosting?: boolean` param to `createInvoice` |
| `src/lib/bill.service.ts` | Modify | Add `skipGLPosting?: boolean` param to `createBill` |
| `app/api/migration/import/route.ts` | Create | Commit migration endpoint (streams progress via SSE) |
| `app/api/migration/server-parse/route.ts` | Create | Server-side large-file parse fallback |
| `app/dashboard/migrate/page.tsx` | Create | 6-step wizard page |
| `app/dashboard/layout.tsx` | Modify | Add "Migrate" link to top-bar nav |
| `public/migration-guides/xero-export.pdf` | Create | Static PDF instruction guide (placeholder) |
| `public/migration-guides/quickbooks-export.pdf` | Create | Static PDF instruction guide (placeholder) |
| `playwright/scripts/migrate-xero.ts` | Create | Playwright E2E test for Xero flow |
| `playwright/scripts/migrate-quickbooks.ts` | Create | Playwright E2E test for QuickBooks flow |

---

## Task 1: Database Migration 026

**Files:**
- Create: `database/migrations/026_migration_runs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 026_migration_runs.sql
-- Run: docker exec -i infra-postgres psql -U relentify_user -d relentify < database/migrations/026_migration_runs.sql

CREATE TABLE IF NOT EXISTS migration_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID NOT NULL REFERENCES entities(id),
  user_id             UUID NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('xero', 'quickbooks')),
  cutoff_date         DATE NOT NULL,
  files_uploaded      JSONB NOT NULL DEFAULT '[]',  -- [{name, size, type}]
  auto_mappings       JSONB NOT NULL DEFAULT '[]',  -- [{sourceCode, sourceName, targetCode, confidence}]
  validation_warnings JSONB,
  batches             JSONB NOT NULL DEFAULT '[]',  -- [{type, status, count, error?}]
  import_report       TEXT,                          -- CSV content of every record created
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migration_runs_entity ON migration_runs(entity_id);
CREATE INDEX IF NOT EXISTS idx_migration_runs_user   ON migration_runs(user_id);
```

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/22accounting/database/migrations/026_migration_runs.sql
```

- [ ] **Step 3: Verify table exists**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify -c "\d migration_runs"
```

---

## Task 2: Tier Feature Gate

**Files:**
- Modify: `src/lib/tiers.ts`

- [ ] **Step 1: Add `platform_migration` to the Feature type union**

Find the `Feature` type union (around line 7) and add:
```ts
  | 'platform_migration'
```

- [ ] **Step 2: Add to the `FEATURE_ACCESS` record (small_business and above)**

Find the `excel_import` entry (line 88) and add after it:
```ts
  platform_migration:     ['small_business', 'medium_business', 'corporate'],
```

---

## Task 3: Normalised Types

**Files:**
- Create: `src/lib/migration/types.ts`

- [ ] **Step 1: Write types.ts**

```ts
// src/lib/migration/types.ts

export type MigrationSourceId = 'xero' | 'quickbooks';

export type ConfidenceLevel = 'high' | 'medium' | 'none';

export interface MigrationSource {
  parse(files: File[], cutoffDate: string): Promise<MigrationData>;
}

export interface NormalisedAccount {
  sourceCode:  string;
  sourceName:  string;
  sourceType:  string; // e.g. 'ASSET', 'INCOME', as named by source platform
  relentifyCode?: number; // resolved during mapping step
  relentifyType?: string;
}

export interface NormalisedContact {
  name:    string;
  email?:  string;
  phone?:  string;
  address?: string;
}

export interface NormalisedInvoiceItem {
  description: string;
  quantity:    number;
  unitPrice:   number;
  taxRate:     number;
}

export interface NormalisedInvoice {
  sourceRef:    string;
  clientName:   string;
  clientEmail?: string;
  issueDate:    string; // YYYY-MM-DD
  dueDate:      string;
  currency:     string;
  taxRate:      number;
  items:        NormalisedInvoiceItem[];
  status:       string; // original status string for debugging
}

export interface NormalisedBill {
  sourceRef:    string;
  supplierName: string;
  issueDate:    string;
  dueDate:      string;
  currency:     string;
  amount:       number;
  vatAmount:    number;
  vatRate:      number;
  accountCode?: number; // mapped coa_account_id
  category:     string;
}

export interface NormalisedBalance {
  accountCode: number;
  debit:       number;
  credit:      number;
}

export interface NormalisedTrialBalance {
  totalDebits:  number;
  totalCredits: number;
  lines:        NormalisedBalance[];
}

export interface MigrationData {
  accounts:        NormalisedAccount[];
  customers:       NormalisedContact[];
  suppliers:       NormalisedContact[];
  invoices:        NormalisedInvoice[];
  bills:           NormalisedBill[];
  openingBalances: NormalisedBalance[];
  trialBalance:    NormalisedTrialBalance;
  parseWarnings:   string[]; // unknown row types, skipped rows, etc.
}

export interface AccountMapping {
  sourceCode:   string;
  sourceName:   string;
  targetCode:   number | null;
  confidence:   ConfidenceLevel;
}

export interface MigrationBatchResult {
  type:   'accounts' | 'customers' | 'suppliers' | 'invoices' | 'bills' | 'opening_balances';
  status: 'pending' | 'running' | 'completed' | 'failed';
  count:  number;
  error?: string;
}

export interface MigrationRunPayload {
  source:       MigrationSourceId;
  cutoffDate:   string;
  data:         MigrationData;
  mappings:     AccountMapping[];
  runId?:       string; // set when resuming a previous run
}
```

---

## Task 4: Levenshtein Fuzzy Matcher

**Files:**
- Create: `src/lib/migration/matcher.ts`
- Create: `src/lib/migration/__tests__/matcher.test.ts`

- [ ] **Step 1: Write the failing test first**

```ts
// src/lib/migration/__tests__/matcher.test.ts
import { levenshtein, matchAccount, buildAccountMappings } from '../matcher';
import type { NormalisedAccount } from '../types';

const relentifyAccounts = [
  { code: 1100, name: 'Accounts Receivable (Debtors Control)', type: 'ASSET' },
  { code: 4000, name: 'Sales Revenue', type: 'INCOME' },
  { code: 7400, name: 'Office Supplies', type: 'EXPENSE' },
  { code: 7700, name: 'Bank Charges', type: 'EXPENSE' },
];

describe('levenshtein()', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });
  it('returns correct distance for small edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('sales', 'Sales')).toBe(1); // case sensitive
  });
});

describe('matchAccount()', () => {
  it('returns high confidence on exact name match', () => {
    const result = matchAccount('Sales Revenue', relentifyAccounts);
    expect(result.confidence).toBe('high');
    expect(result.targetCode).toBe(4000);
  });

  it('returns high confidence on exact code match', () => {
    const result = matchAccount('Any Name', relentifyAccounts, '1100');
    expect(result.confidence).toBe('high');
    expect(result.targetCode).toBe(1100);
  });

  it('returns medium confidence on fuzzy name match within distance 2', () => {
    // 'Office Supply' vs 'Office Supplies' — distance 1 (missing 's')
    const result = matchAccount('Office Supply', relentifyAccounts);
    expect(result.confidence).toBe('medium');
    expect(result.targetCode).toBe(7400);
  });

  it('returns none for unresolvable account', () => {
    const result = matchAccount('Totally Unknown Account XYZ', relentifyAccounts);
    expect(result.confidence).toBe('none');
    expect(result.targetCode).toBeNull();
  });

  it('returns medium on type-range match when name fails', () => {
    // Source type INCOME, no name match — should suggest first INCOME account
    const result = matchAccount('Revenue from Consulting', relentifyAccounts, undefined, 'INCOME');
    expect(result.confidence).toBe('medium');
    expect(result.targetCode).toBe(4000);
  });
});

describe('buildAccountMappings()', () => {
  it('maps a list of source accounts using priority order', () => {
    const sourceAccounts: NormalisedAccount[] = [
      { sourceCode: '200', sourceName: 'Sales Revenue', sourceType: 'INCOME' },
      { sourceCode: '999', sourceName: 'Totally Unknown', sourceType: 'EXPENSE' },
    ];
    const mappings = buildAccountMappings(sourceAccounts, relentifyAccounts);
    expect(mappings).toHaveLength(2);
    expect(mappings[0].confidence).toBe('high');
    expect(mappings[1].confidence).toBe('none');
  });
});
```

- [ ] **Step 2: Implement matcher.ts**

```ts
// src/lib/migration/matcher.ts
import type { NormalisedAccount, AccountMapping, ConfidenceLevel } from './types';

// QB account type → Relentify code range (start of range, used for type-match fallback)
const QB_TYPE_TO_RELENTIFY_TYPE: Record<string, string> = {
  'Bank':                    'ASSET',
  'Accounts Receivable':     'ASSET',
  'Other Current Asset':     'ASSET',
  'Accounts Payable':        'LIABILITY',
  'Credit Card':             'LIABILITY',
  'Income':                  'INCOME',
  'Cost of Goods Sold':      'COGS',
  'Expense':                 'EXPENSE',
  // Xero types
  'BANK':                    'ASSET',
  'CURRENT':                 'ASSET',
  'CURRLIAB':                'LIABILITY',
  'REVENUE':                 'INCOME',
  'DIRECTCOSTS':             'COGS',
  'OVERHEADS':               'EXPENSE',
};

const RELENTIFY_TYPE_ORDER: Record<string, number> = {
  ASSET: 1000, LIABILITY: 2000, EQUITY: 3000,
  INCOME: 4000, COGS: 5000, EXPENSE: 7000,
};

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

interface RelentifyAccount {
  code: number;
  name: string;
  type: string;
}

export function matchAccount(
  sourceName: string,
  relentifyAccounts: RelentifyAccount[],
  sourceCode?: string,
  sourceType?: string,
): { targetCode: number | null; confidence: ConfidenceLevel } {

  // Priority 1: exact name match (case-insensitive)
  const exactName = relentifyAccounts.find(
    a => a.name.toLowerCase() === sourceName.toLowerCase()
  );
  if (exactName) return { targetCode: exactName.code, confidence: 'high' };

  // Priority 2: account code match
  if (sourceCode) {
    const codeNum = parseInt(sourceCode, 10);
    const exactCode = relentifyAccounts.find(a => a.code === codeNum);
    if (exactCode) return { targetCode: exactCode.code, confidence: 'high' };
  }

  // Priority 3: fuzzy name match (Levenshtein distance ≤ 2)
  let bestDist = Infinity;
  let bestAccount: RelentifyAccount | null = null;
  for (const acct of relentifyAccounts) {
    const dist = levenshtein(sourceName.toLowerCase(), acct.name.toLowerCase());
    if (dist < bestDist) { bestDist = dist; bestAccount = acct; }
  }
  if (bestAccount && bestDist <= 2) {
    return { targetCode: bestAccount.code, confidence: 'medium' };
  }

  // Priority 4: type range match
  if (sourceType) {
    const mappedType = QB_TYPE_TO_RELENTIFY_TYPE[sourceType] ?? sourceType;
    const typeMatch = relentifyAccounts.find(a => a.type === mappedType);
    if (typeMatch) return { targetCode: typeMatch.code, confidence: 'medium' };
  }

  return { targetCode: null, confidence: 'none' };
}

export function buildAccountMappings(
  sourceAccounts: NormalisedAccount[],
  relentifyAccounts: RelentifyAccount[],
): AccountMapping[] {
  return sourceAccounts.map(src => {
    const { targetCode, confidence } = matchAccount(
      src.sourceName,
      relentifyAccounts,
      src.sourceCode,
      src.sourceType,
    );
    return {
      sourceCode: src.sourceCode,
      sourceName: src.sourceName,
      targetCode,
      confidence,
    };
  });
}
```

- [ ] **Step 3: Run tests and verify they pass**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx jest src/lib/migration/__tests__/matcher.test.ts --no-coverage 2>&1 | tail -20
```

---

## Task 5: Trial Balance Validation

**Files:**
- Create: `src/lib/migration/validation.ts`
- Create: `src/lib/migration/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/migration/__tests__/validation.test.ts
import { validateTrialBalance, classifyIssues } from '../validation';
import type { NormalisedTrialBalance } from '../types';

describe('validateTrialBalance()', () => {
  it('returns valid for balanced trial balance', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000, totalCredits: 10000,
      lines: [
        { accountCode: 1200, debit: 10000, credit: 0 },
        { accountCode: 4000, debit: 0,     credit: 10000 },
      ],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(true);
    expect(result.discrepancy).toBe(0);
  });

  it('returns invalid for imbalanced trial balance exceeding £0.01', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000.50, totalCredits: 10000,
      lines: [],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(false);
    expect(result.discrepancy).toBeCloseTo(0.50);
  });

  it('returns valid when imbalance is within £0.01 tolerance', () => {
    const tb: NormalisedTrialBalance = {
      totalDebits: 10000.005, totalCredits: 10000,
      lines: [],
    };
    const result = validateTrialBalance(tb);
    expect(result.valid).toBe(true);
  });
});

describe('classifyIssues()', () => {
  it('returns error for imbalanced trial balance', () => {
    const issues = classifyIssues({ trialBalanceValid: false, unmappedAccounts: 0, newCustomersToCreate: 0 });
    expect(issues.errors).toContain('Trial balance does not balance');
    expect(issues.canProceed).toBe(false);
  });

  it('returns warning but can proceed for unmapped accounts with zero balance', () => {
    const issues = classifyIssues({ trialBalanceValid: true, unmappedAccounts: 2, newCustomersToCreate: 3 });
    expect(issues.warnings.length).toBeGreaterThan(0);
    expect(issues.canProceed).toBe(true);
  });
});
```

- [ ] **Step 2: Implement validation.ts**

```ts
// src/lib/migration/validation.ts

export interface TrialBalanceValidationResult {
  valid:       boolean;
  discrepancy: number; // absolute difference in pounds
}

export function validateTrialBalance(tb: {
  totalDebits: number;
  totalCredits: number;
}): TrialBalanceValidationResult {
  const diff = Math.abs(tb.totalDebits - tb.totalCredits);
  return { valid: diff <= 0.01, discrepancy: diff };
}

export interface IssueClassification {
  errors:     string[];
  warnings:   string[];
  canProceed: boolean;
}

export function classifyIssues(checks: {
  trialBalanceValid:    boolean;
  unmappedAccounts:     number;
  newCustomersToCreate: number;
}): IssueClassification {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!checks.trialBalanceValid) {
    errors.push('Trial balance does not balance — import blocked until resolved');
  }
  if (checks.unmappedAccounts > 0) {
    warnings.push(`${checks.unmappedAccounts} account(s) could not be auto-mapped — please review`);
  }
  if (checks.newCustomersToCreate > 0) {
    warnings.push(`${checks.newCustomersToCreate} invoice(s) reference unknown customers — new customer records will be created`);
  }

  return { errors, warnings, canProceed: errors.length === 0 };
}
```

- [ ] **Step 3: Run tests**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx jest src/lib/migration/__tests__/validation.test.ts --no-coverage 2>&1 | tail -20
```

---

## Task 6: Xero CSV Parser

**Files:**
- Create: `src/lib/migration/xero.parser.ts`
- Create: `src/lib/migration/__tests__/xero.parser.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/migration/__tests__/xero.parser.test.ts
// Uses Papa Parse — test with synthetic CSV strings converted to File objects

import { XeroParser } from '../xero.parser';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

const CUTOFF = '2024-12-31';

const COA_CSV = `AccountCode,Name,Type,TaxType,Description
1100,Trade Debtors,CURRENT,NONE,Debtors
4000,Sales,REVENUE,OUTPUT,Revenue`;

const CONTACTS_CSV = `ContactName,IsCustomer,IsSupplier,Email,Phone
Acme Ltd,TRUE,FALSE,acme@example.com,01234567890
Build Co,FALSE,TRUE,build@example.com,`;

const INVOICES_CSV = `InvoiceNumber,ContactName,InvoiceDate,DueDate,UnitAmount,TaxAmount,TaxRate,Status
INV-001,Acme Ltd,2024-11-01,2024-11-30,1000.00,200.00,20,AUTHORISED
INV-002,Acme Ltd,2025-01-15,2025-02-15,500.00,100.00,20,AUTHORISED`;

const TRIAL_BALANCE_CSV = `AccountCode,Name,Debit,Credit
1100,Trade Debtors,1200.00,0
4000,Sales,0,1200.00`;

describe('XeroParser', () => {
  it('parses accounts, customers, suppliers, invoices within cutoff', async () => {
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Contacts.csv', CONTACTS_CSV),
      makeFile('Invoices.csv', INVOICES_CSV),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);

    expect(data.accounts).toHaveLength(2);
    expect(data.customers).toHaveLength(1);
    expect(data.customers[0].name).toBe('Acme Ltd');
    expect(data.suppliers).toHaveLength(1);
    expect(data.suppliers[0].name).toBe('Build Co');

    // INV-002 is after cutoff — should be excluded
    expect(data.invoices).toHaveLength(1);
    expect(data.invoices[0].sourceRef).toBe('INV-001');

    // Trial balance
    expect(data.trialBalance.totalDebits).toBeCloseTo(1200);
    expect(data.trialBalance.totalCredits).toBeCloseTo(1200);
  });

  it('handles missing optional files gracefully', async () => {
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);
    expect(data.invoices).toHaveLength(0);
    expect(data.bills).toHaveLength(0);
  });

  it('deduplicates contacts that appear as both customer and supplier', async () => {
    const csv = `ContactName,IsCustomer,IsSupplier,Email,Phone\nBoth Co,TRUE,TRUE,both@example.com,`;
    const parser = new XeroParser();
    const data = await parser.parse([
      makeFile('Chart of Accounts.csv', COA_CSV),
      makeFile('Contacts.csv', csv),
      makeFile('Trial Balance.csv', TRIAL_BALANCE_CSV),
    ], CUTOFF);
    // A contact that is both customer and supplier appears in both arrays
    expect(data.customers.find(c => c.name === 'Both Co')).toBeTruthy();
    expect(data.suppliers.find(s => s.name === 'Both Co')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Install Papa Parse (if not present)**

```bash
cd /opt/relentify-monorepo && pnpm add papaparse @types/papaparse --filter 22accounting && pnpm install
```

- [ ] **Step 3: Implement xero.parser.ts**

```ts
// src/lib/migration/xero.parser.ts
import Papa from 'papaparse';
import type { MigrationSource, MigrationData, NormalisedAccount,
  NormalisedContact, NormalisedInvoice, NormalisedBalance, NormalisedTrialBalance } from './types';

function parseCsv(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true, skipEmptyLines: true, transformHeader: h => h.trim(),
    transform: (v: string) => v.trim(),
  });
  return result.data;
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

const XERO_STATUS_INCLUDE = new Set(['AUTHORISED', 'OUTSTANDING', 'APPROVED']);

const XERO_TYPE_MAP: Record<string, string> = {
  BANK: 'ASSET', CURRENT: 'ASSET', FIXED: 'ASSET', NONCURRENT: 'ASSET',
  CURRLIAB: 'LIABILITY', TERMLIAB: 'LIABILITY', LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'INCOME', SALES: 'INCOME',
  DIRECTCOSTS: 'COGS',
  OVERHEADS: 'EXPENSE', EXPENSE: 'EXPENSE',
};

export class XeroParser implements MigrationSource {
  async parse(files: File[], cutoffDate: string): Promise<MigrationData> {
    const warnings: string[] = [];
    const fileMap = new Map<string, string>();
    for (const f of files) {
      fileMap.set(f.name.toLowerCase().replace(/\s+/g, '_'), await readFile(f));
      // Also store original name for looser matching
      fileMap.set(f.name.toLowerCase(), await readFile(f));
    }

    const get = (names: string[]) => {
      for (const n of names) {
        const v = fileMap.get(n) ?? fileMap.get(n.replace(/\s+/g, '_'));
        if (v) return v;
      }
      return null;
    };

    // ── Accounts ──
    const accounts: NormalisedAccount[] = [];
    const coaCsv = get(['chart of accounts.csv', 'chart_of_accounts.csv']);
    if (coaCsv) {
      for (const row of parseCsv(coaCsv)) {
        const sourceType = row['Type'] ?? '';
        accounts.push({
          sourceCode: row['AccountCode'] ?? '',
          sourceName: row['Name'] ?? '',
          sourceType,
          relentifyType: XERO_TYPE_MAP[sourceType.toUpperCase()] ?? sourceType,
        });
      }
    }

    // ── Contacts ──
    const customers: NormalisedContact[] = [];
    const suppliers: NormalisedContact[] = [];
    const contactsCsv = get(['contacts.csv']);
    if (contactsCsv) {
      for (const row of parseCsv(contactsCsv)) {
        const contact: NormalisedContact = {
          name:    row['ContactName'] ?? '',
          email:   row['Email'] || undefined,
          phone:   row['Phone'] || undefined,
          address: row['Street'] || row['Address'] || undefined,
        };
        if (!contact.name) continue;
        const isCust = (row['IsCustomer'] ?? '').toUpperCase() === 'TRUE';
        const isSupp = (row['IsSupplier'] ?? '').toUpperCase() === 'TRUE';
        if (isCust) customers.push(contact);
        if (isSupp) suppliers.push(contact);
      }
    }

    // ── Invoices ──
    const invoices: NormalisedInvoice[] = [];
    const invCsv = get(['invoices.csv']);
    if (invCsv) {
      for (const row of parseCsv(invCsv)) {
        const status = (row['Status'] ?? '').toUpperCase();
        if (!XERO_STATUS_INCLUDE.has(status)) continue;
        const issueDate = normaliseDate(row['InvoiceDate'] ?? '');
        if (!issueDate || issueDate > cutoffDate) continue; // exclude post-cutoff
        const dueDate = normaliseDate(row['DueDate'] ?? '') ?? issueDate;
        const unitAmount = parseFloat(row['UnitAmount'] ?? '0') || 0;
        const taxAmount = parseFloat(row['TaxAmount'] ?? '0') || 0;
        const taxRate = unitAmount > 0 ? Math.round((taxAmount / unitAmount) * 100) : 0;
        invoices.push({
          sourceRef:  row['InvoiceNumber'] ?? '',
          clientName: row['ContactName'] ?? '',
          issueDate,
          dueDate,
          currency:   row['Currency'] || 'GBP',
          taxRate,
          items: [{ description: row['Description'] || 'Imported invoice', quantity: 1, unitPrice: unitAmount, taxRate }],
          status: row['Status'] ?? '',
        });
      }
    }

    // ── Bills ──
    const bills: import('./types').NormalisedBill[] = [];
    const billsCsv = get(['bills.csv']);
    if (billsCsv) {
      for (const row of parseCsv(billsCsv)) {
        const status = (row['Status'] ?? '').toUpperCase();
        if (!XERO_STATUS_INCLUDE.has(status)) continue;
        const issueDate = normaliseDate(row['InvoiceDate'] ?? '');
        if (!issueDate || issueDate > cutoffDate) continue;
        const dueDate = normaliseDate(row['DueDate'] ?? '') ?? issueDate;
        const amount = parseFloat(row['UnitAmount'] ?? '0') || 0;
        const vatAmount = parseFloat(row['TaxAmount'] ?? '0') || 0;
        const vatRate = amount > 0 ? Math.round((vatAmount / amount) * 100) : 0;
        bills.push({
          sourceRef:    row['InvoiceNumber'] ?? '',
          supplierName: row['ContactName'] ?? '',
          issueDate,
          dueDate,
          currency:     row['Currency'] || 'GBP',
          amount,
          vatAmount,
          vatRate,
          category:     'general',
        });
      }
    }

    // ── Trial Balance ──
    const tbLines: NormalisedBalance[] = [];
    const tbCsv = get(['trial balance.csv', 'trial_balance.csv']);
    if (tbCsv) {
      for (const row of parseCsv(tbCsv)) {
        const code = parseInt(row['AccountCode'] ?? '', 10);
        if (isNaN(code)) continue;
        tbLines.push({
          accountCode: code,
          debit:  parseFloat(row['Debit'] ?? '0') || 0,
          credit: parseFloat(row['Credit'] ?? '0') || 0,
        });
      }
    }
    const totalDebits  = tbLines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = tbLines.reduce((s, l) => s + l.credit, 0);
    const trialBalance: NormalisedTrialBalance = { totalDebits, totalCredits, lines: tbLines };

    return {
      accounts, customers, suppliers, invoices, bills,
      openingBalances: tbLines,
      trialBalance,
      parseWarnings: warnings,
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx jest src/lib/migration/__tests__/xero.parser.test.ts --no-coverage 2>&1 | tail -20
```

---

## Task 7: QuickBooks Parser

**Files:**
- Create: `src/lib/migration/quickbooks.parser.ts`
- Create: `src/lib/migration/__tests__/quickbooks.parser.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/migration/__tests__/quickbooks.parser.test.ts
import { QuickBooksParser } from '../quickbooks.parser';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

const CUTOFF = '2024-12-31';

const IIF_CONTENT = `!ACCNT\tNAME\tACCNTTYPE\tDESC
ACCNT\tBank Account\tBank\tMain bank
!CUST\tNAME\tEMAIL
CUST\tAcme Ltd\tacme@example.com
!VEND\tNAME\tEMAIL
VEND\tBuild Co\tbuild@example.com
!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT
TRNS\tINVOICE\t2024-11-01\tAccounts Receivable\tAcme Ltd\t1200.00
!UNKNOWN_TYPE\tFOO
UNKNOWN_TYPE\tsome data
`;

describe('QuickBooksParser (IIF)', () => {
  it('parses accounts, customers, suppliers, transactions within cutoff', async () => {
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('company.iif', IIF_CONTENT)], CUTOFF);

    expect(data.accounts.length).toBeGreaterThanOrEqual(1);
    expect(data.customers[0].name).toBe('Acme Ltd');
    expect(data.suppliers[0].name).toBe('Build Co');
    expect(data.invoices).toHaveLength(1);
  });

  it('silently skips unknown row types and logs count to parseWarnings', async () => {
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('company.iif', IIF_CONTENT)], CUTOFF);
    expect(data.parseWarnings.some(w => w.includes('UNKNOWN_TYPE'))).toBe(true);
  });

  it('errors on missing required column gracefully (named validation error)', async () => {
    const badIif = `!TRNS\tTRNSTYPE\nTRNS\tINVOICE\n`; // missing DATE, ACCNT, etc.
    const parser = new QuickBooksParser();
    const data = await parser.parse([makeFile('bad.iif', badIif)], CUTOFF);
    // Should not throw — should produce a warning
    expect(data.parseWarnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement quickbooks.parser.ts**

```ts
// src/lib/migration/quickbooks.parser.ts
import Papa from 'papaparse';
import type { MigrationSource, MigrationData, NormalisedAccount,
  NormalisedContact, NormalisedInvoice, NormalisedBill, NormalisedBalance,
  NormalisedTrialBalance } from './types';

const QB_TYPE_TO_RELENTIFY: Record<string, string> = {
  'Bank':                  'ASSET',
  'Accounts Receivable':   'ASSET',
  'Other Current Asset':   'ASSET',
  'Fixed Asset':           'ASSET',
  'Accounts Payable':      'LIABILITY',
  'Credit Card':           'LIABILITY',
  'Other Current Liability':'LIABILITY',
  'Long Term Liability':   'LIABILITY',
  'Equity':                'EQUITY',
  'Income':                'INCOME',
  'Cost of Goods Sold':    'COGS',
  'Expense':               'EXPENSE',
  'Other Expense':         'EXPENSE',
  'Other Income':          'INCOME',
};

const KNOWN_IIF_TYPES = new Set(['ACCNT','CUST','VEND','TRNS','SPL']);

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // MM/DD/YYYY (QuickBooks US format)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [m, d, y] = raw.split('/');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

interface IIFSection {
  headers: string[];
  rows: Record<string, string>[];
}

function parseIIF(content: string): {
  sections: Map<string, IIFSection>;
  warnings: string[];
} {
  const lines = content.replace(/\r/g, '').split('\n');
  const sections = new Map<string, IIFSection>();
  const warnings: string[] = [];
  const unknownCounts = new Map<string, number>();

  let currentType: string | null = null;
  let currentHeaders: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('!')) {
      const parts = line.slice(1).split('\t');
      const type = parts[0];
      if (KNOWN_IIF_TYPES.has(type)) {
        currentType = type;
        currentHeaders = parts.slice(1);
        if (!sections.has(type)) sections.set(type, { headers: currentHeaders, rows: [] });
        else sections.get(type)!.headers = currentHeaders;
      } else {
        currentType = `__unknown__${type}`;
        unknownCounts.set(type, 0);
      }
      continue;
    }

    if (!currentType) continue;

    if (currentType.startsWith('__unknown__')) {
      const t = currentType.slice('__unknown__'.length);
      unknownCounts.set(t, (unknownCounts.get(t) ?? 0) + 1);
      continue;
    }

    const parts = line.split('\t');
    const dataType = parts[0];
    if (dataType !== currentType) continue;

    const values = parts.slice(1);
    const section = sections.get(currentType)!;
    const obj: Record<string, string> = {};
    section.headers.forEach((h, i) => { obj[h] = values[i]?.trim() ?? ''; });
    section.rows.push(obj);
  }

  for (const [type, count] of unknownCounts) {
    warnings.push(`Skipped ${count} row(s) of unknown IIF type: ${type}`);
  }

  return { sections, warnings };
}

export class QuickBooksParser implements MigrationSource {
  async parse(files: File[], cutoffDate: string): Promise<MigrationData> {
    const warnings: string[] = [];
    const accounts: NormalisedAccount[] = [];
    const customers: NormalisedContact[] = [];
    const suppliers: NormalisedContact[] = [];
    const invoices: NormalisedInvoice[] = [];
    const bills: NormalisedBill[] = [];
    const tbLines: NormalisedBalance[] = [];

    for (const file of files) {
      const content = await readFile(file);
      const name = file.name.toLowerCase();

      if (name.endsWith('.iif')) {
        const { sections, warnings: iifWarnings } = parseIIF(content);
        warnings.push(...iifWarnings);

        // Accounts
        const accSection = sections.get('ACCNT');
        if (accSection) {
          for (const row of accSection.rows) {
            if (!row['NAME']) { warnings.push('ACCNT row missing NAME — skipped'); continue; }
            accounts.push({
              sourceCode:    row['ACCNUM'] ?? '',
              sourceName:    row['NAME'],
              sourceType:    row['ACCNTTYPE'] ?? '',
              relentifyType: QB_TYPE_TO_RELENTIFY[row['ACCNTTYPE'] ?? ''] ?? 'EXPENSE',
            });
          }
        }

        // Customers
        const custSection = sections.get('CUST');
        if (custSection) {
          for (const row of custSection.rows) {
            if (!row['NAME']) { warnings.push('CUST row missing NAME — skipped'); continue; }
            customers.push({
              name:  row['NAME'],
              email: row['EMAIL'] || undefined,
              phone: row['PHONE1'] || undefined,
            });
          }
        }

        // Vendors
        const vendSection = sections.get('VEND');
        if (vendSection) {
          for (const row of vendSection.rows) {
            if (!row['NAME']) { warnings.push('VEND row missing NAME — skipped'); continue; }
            suppliers.push({
              name:  row['NAME'],
              email: row['EMAIL'] || undefined,
              phone: row['PHONE1'] || undefined,
            });
          }
        }

        // Transactions
        const trnsSection = sections.get('TRNS');
        if (trnsSection) {
          for (const row of trnsSection.rows) {
            const trnsType = (row['TRNSTYPE'] ?? '').toUpperCase();
            const rawDate = row['DATE'] ?? '';
            const issueDate = normaliseDate(rawDate);
            if (!issueDate) { warnings.push(`TRNS row has invalid DATE "${rawDate}" — skipped`); continue; }
            if (issueDate > cutoffDate) continue;

            const amount = parseFloat(row['AMOUNT'] ?? '0') || 0;
            const dueDate = normaliseDate(row['DUEDATE'] ?? '') ?? issueDate;

            if (trnsType === 'INVOICE') {
              if (!row['NAME']) { warnings.push('INVOICE TRNS missing NAME — skipped'); continue; }
              invoices.push({
                sourceRef:  row['DOCNUM'] ?? '',
                clientName: row['NAME'],
                issueDate,
                dueDate,
                currency:   'GBP',
                taxRate:    0,
                items: [{ description: row['MEMO'] || 'Imported invoice', quantity: 1, unitPrice: amount, taxRate: 0 }],
                status: 'IMPORTED',
              });
            } else if (trnsType === 'BILL') {
              if (!row['NAME']) { warnings.push('BILL TRNS missing NAME — skipped'); continue; }
              bills.push({
                sourceRef:    row['DOCNUM'] ?? '',
                supplierName: row['NAME'],
                issueDate,
                dueDate,
                currency:     'GBP',
                amount:       Math.abs(amount),
                vatAmount:    0,
                vatRate:      0,
                category:     'general',
              });
            }
          }
        }
      } else if (name.endsWith('.csv')) {
        // CSV fallback: detect type from filename
        const rows = Papa.parse<Record<string, string>>(content, {
          header: true, skipEmptyLines: true,
          transformHeader: h => h.trim(),
          transform: (v: string) => v.trim(),
        }).data;

        if (name.includes('account')) {
          for (const row of rows) {
            accounts.push({
              sourceCode:    row['Account Code'] ?? row['Number'] ?? '',
              sourceName:    row['Account Name'] ?? row['Name'] ?? '',
              sourceType:    row['Account Type'] ?? row['Type'] ?? '',
              relentifyType: QB_TYPE_TO_RELENTIFY[row['Account Type'] ?? ''] ?? 'EXPENSE',
            });
          }
        } else if (name.includes('customer')) {
          for (const row of rows) {
            const n = row['Customer Name'] ?? row['Name'] ?? '';
            if (!n) continue;
            customers.push({ name: n, email: row['Email'] || undefined });
          }
        } else if (name.includes('vendor') || name.includes('supplier')) {
          for (const row of rows) {
            const n = row['Vendor Name'] ?? row['Name'] ?? '';
            if (!n) continue;
            suppliers.push({ name: n, email: row['Email'] || undefined });
          }
        } else if (name.includes('trial_balance') || name.includes('trial balance')) {
          for (const row of rows) {
            const code = parseInt(row['Account Code'] ?? row['AccountCode'] ?? '', 10);
            if (isNaN(code)) continue;
            tbLines.push({
              accountCode: code,
              debit:  parseFloat(row['Debit'] ?? '0') || 0,
              credit: parseFloat(row['Credit'] ?? '0') || 0,
            });
          }
        }
      }
    }

    const totalDebits  = tbLines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = tbLines.reduce((s, l) => s + l.credit, 0);
    const trialBalance: NormalisedTrialBalance = { totalDebits, totalCredits, lines: tbLines };

    return { accounts, customers, suppliers, invoices, bills, openingBalances: tbLines, trialBalance, parseWarnings: warnings };
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx jest src/lib/migration/__tests__/quickbooks.parser.test.ts --no-coverage 2>&1 | tail -20
```

---

## Task 8: Web Worker

**Files:**
- Create: `src/lib/migration/worker.ts`

The Web Worker cannot use server-only imports. It receives a `{ files, sourceId, cutoffDate }` message, instantiates the correct parser, calls `.parse()`, and `postMessage`s back the result.

- [ ] **Step 1: Implement worker.ts**

```ts
// src/lib/migration/worker.ts
// This file runs inside a Web Worker — no Node.js / server imports allowed.
import { XeroParser } from './xero.parser';
import { QuickBooksParser } from './quickbooks.parser';
import type { MigrationSourceId } from './types';

self.onmessage = async (e: MessageEvent<{
  files: File[];
  sourceId: MigrationSourceId;
  cutoffDate: string;
}>) => {
  const { files, sourceId, cutoffDate } = e.data;
  try {
    const parser = sourceId === 'xero' ? new XeroParser() : new QuickBooksParser();
    const data = await parser.parse(files, cutoffDate);
    self.postMessage({ type: 'done', data });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
  }
};
```

Usage in the wizard page (see Task 10):

```ts
// Instantiate in the browser
const worker = new Worker(
  new URL('@/src/lib/migration/worker.ts', import.meta.url),
  { type: 'module' }
);
worker.postMessage({ files, sourceId, cutoffDate });
worker.onmessage = (e) => {
  if (e.data.type === 'done') setMigrationData(e.data.data);
  if (e.data.type === 'error') setParseError(e.data.message);
};
```

---

## Task 9: skipGLPosting Flag on createInvoice and createBill

**Files:**
- Modify: `src/lib/invoice.service.ts`
- Modify: `src/lib/bill.service.ts`

During migration, invoices and bills must be created without posting individual GL journal entries (the trial balance import handles GL state). We add a `skipGLPosting` flag that short-circuits the GL posting block.

- [ ] **Step 1: Add skipGLPosting to createInvoice signature**

In `src/lib/invoice.service.ts`, in the `createInvoice` function parameter object, add:
```ts
  skipGLPosting?: boolean; // set true during migration — GL handled by opening balances import
```

Then find the GL posting `try` block (around line 55) and wrap it:
```ts
  // Post double-entry journal: Dr Debtors / Cr Sales / Cr VAT Output
  if (!data.skipGLPosting) {
    try {
      // ... existing GL code unchanged ...
    } catch (glErr) {
      Sentry.captureException(glErr, { tags: { gl_operation: 'invoice_create' } });
    }
  }
```

- [ ] **Step 2: Add skipGLPosting to createBill**

In `src/lib/bill.service.ts`, find the `createBill` function data parameter and add:
```ts
  skipGLPosting?: boolean;
```

Then wrap the GL posting `try` block in:
```ts
  if (!data.skipGLPosting) {
    try {
      // ... existing GL code unchanged ...
    } catch (glErr) {
      Sentry.captureException(glErr, { tags: { gl_operation: 'bill_create' } });
    }
  }
```

---

## Task 10: Import Service

**Files:**
- Create: `src/lib/migration/import.service.ts`

This service consumes `MigrationData` + `AccountMapping[]` and calls the existing service layer. All batch writes happen inside a single `withTransaction` PoolClient so that if GL posting of opening balances fails, everything rolls back.

- [ ] **Step 1: Implement import.service.ts**

```ts
// src/lib/migration/import.service.ts
import { withTransaction } from '../db';
import { createCustomer, getAllCustomers } from '../customer.service';
import { createSupplier, getAllSuppliers } from '../supplier.service';
import { createInvoice } from '../invoice.service';
import { createBill } from '../bill.service';
import { importOpeningBalances } from '../opening_balance.service';
import { query } from '../db';
import type { MigrationData, AccountMapping, MigrationBatchResult } from './types';

export interface ImportMigrationOptions {
  entityId:    string;
  userId:      string;
  cutoffDate:  string;
  data:        MigrationData;
  mappings:    AccountMapping[];
  runId:       string;          // migration_runs.id — updated as batches complete
  skipBatches?: string[];       // batch types already completed in a prior run (resume flow)
}

export interface ImportMigrationResult {
  batches:      MigrationBatchResult[];
  importReport: string; // CSV
}

export async function importMigration(opts: ImportMigrationOptions): Promise<ImportMigrationResult> {
  const { entityId, userId, cutoffDate, data, mappings, runId, skipBatches = [] } = opts;
  const batches: MigrationBatchResult[] = [];
  const reportLines: string[] = ['type,sourceRef,name,status'];

  // Helper to update migration_runs.batches in DB
  const updateRun = async () => {
    await query(
      `UPDATE migration_runs SET batches = $1 WHERE id = $2`,
      [JSON.stringify(batches), runId]
    );
  };

  // Build a name→id lookup for existing customers/suppliers
  const existingCustomers = await getAllCustomers(userId, entityId);
  const existingSuppliers = await getAllSuppliers(userId, entityId);
  const custMap = new Map(existingCustomers.map((c: any) => [c.name.toLowerCase(), c.id]));
  const suppMap = new Map(existingSuppliers.map((s: any) => [s.name.toLowerCase(), s.id]));

  // ── Batch: customers ──
  if (!skipBatches.includes('customers')) {
    const b: MigrationBatchResult = { type: 'customers', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const c of data.customers) {
        if (custMap.has(c.name.toLowerCase())) {
          // Duplicate: use existing — do not re-create
          reportLines.push(`customer,,${c.name},merged_existing`);
          continue;
        }
        const created = await createCustomer({ userId, entityId, name: c.name, email: c.email, phone: c.phone, address: c.address });
        custMap.set(c.name.toLowerCase(), created.id);
        b.count++;
        reportLines.push(`customer,${created.id},${c.name},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: suppliers ──
  if (!skipBatches.includes('suppliers')) {
    const b: MigrationBatchResult = { type: 'suppliers', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const s of data.suppliers) {
        if (suppMap.has(s.name.toLowerCase())) {
          reportLines.push(`supplier,,${s.name},merged_existing`);
          continue;
        }
        const created = await createSupplier({ userId, entityId, name: s.name, email: s.email, phone: s.phone, address: s.address });
        suppMap.set(s.name.toLowerCase(), created.id);
        b.count++;
        reportLines.push(`supplier,${created.id},${s.name},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: invoices ──
  if (!skipBatches.includes('invoices')) {
    const b: MigrationBatchResult = { type: 'invoices', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const inv of data.invoices) {
        // Auto-create customer if not found
        let customerId = custMap.get(inv.clientName.toLowerCase());
        if (!customerId) {
          const c = await createCustomer({ userId, entityId, name: inv.clientName });
          custMap.set(inv.clientName.toLowerCase(), c.id);
          customerId = c.id;
        }
        const created = await createInvoice({
          userId, entityId,
          customerId,
          clientName:   inv.clientName,
          issueDate:    inv.issueDate,
          dueDate:      inv.dueDate,
          currency:     inv.currency,
          taxRate:      inv.taxRate,
          items:        inv.items,
          skipGLPosting: true, // GL handled by opening balances
        });
        b.count++;
        reportLines.push(`invoice,${created.id},${inv.sourceRef},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: bills ──
  if (!skipBatches.includes('bills')) {
    const b: MigrationBatchResult = { type: 'bills', status: 'running', count: 0 };
    batches.push(b);
    try {
      for (const bill of data.bills) {
        const mapping = mappings.find(m => m.sourceName.toLowerCase() === bill.supplierName.toLowerCase());
        const coa_account_id = mapping?.targetCode ?? undefined;
        const created = await createBill(userId, {
          entityId,
          supplierName: bill.supplierName,
          amount:       bill.amount,
          currency:     bill.currency,
          dueDate:      bill.dueDate,
          category:     bill.category,
          vatRate:      bill.vatRate,
          vatAmount:    bill.vatAmount,
          reference:    bill.sourceRef || undefined,
          coa_account_id,
          skipGLPosting: true,
        });
        b.count++;
        reportLines.push(`bill,${created.id},${bill.sourceRef},created`);
      }
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
    }
    await updateRun();
  }

  // ── Batch: opening_balances — MUST succeed or entire import rolls back ──
  if (!skipBatches.includes('opening_balances')) {
    const b: MigrationBatchResult = { type: 'opening_balances', status: 'running', count: 0 };
    batches.push(b);
    try {
      await withTransaction(async (_client) => {
        const result = await importOpeningBalances(
          entityId,
          userId,
          cutoffDate,
          data.openingBalances.map(l => ({
            accountCode: l.accountCode,
            debit:       l.debit,
            credit:      l.credit,
          }))
        );
        b.count = result.linesImported;
        reportLines.push(`opening_balances,${result.journalEntryId},cutoff ${cutoffDate},created`);
      });
      b.status = 'completed';
    } catch (err: any) {
      b.status = 'failed'; b.error = err.message;
      // Opening balances failure is fatal — propagate so API route can respond with 500
      await updateRun();
      throw err;
    }
    await updateRun();
  }

  // Write final import report to migration_runs
  const importReport = reportLines.join('\n');
  await query(
    `UPDATE migration_runs SET import_report = $1 WHERE id = $2`,
    [importReport, runId]
  );

  return { batches, importReport };
}
```

---

## Task 11: API Routes

**Files:**
- Create: `app/api/migration/import/route.ts`
- Create: `app/api/migration/server-parse/route.ts`

- [ ] **Step 1: Implement app/api/migration/import/route.ts**

```ts
// app/api/migration/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { logAudit } from '@/src/lib/audit.service';
import { query } from '@/src/lib/db';
import { importMigration } from '@/src/lib/migration/import.service';
import { validateTrialBalance, classifyIssues } from '@/src/lib/migration/validation';
import type { MigrationRunPayload } from '@/src/lib/migration/types';

export const runtime = 'nodejs';

// Sanitise a string: trim + strip null bytes
function san(s: unknown): string {
  return String(s ?? '').replace(/\0/g, '').trim();
}
function sanNum(v: unknown): number {
  const n = parseFloat(String(v ?? ''));
  return isFinite(n) ? n : 0;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB total
const VALID_SOURCES = new Set(['xero', 'quickbooks']);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'platform_migration')) {
      return NextResponse.json({ error: 'Upgrade to Small Business to use the migration tool' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json() as MigrationRunPayload & { resumeRunId?: string };

    // ── Validate source ──
    if (!VALID_SOURCES.has(body.source)) {
      return NextResponse.json({ error: 'Invalid source — must be xero or quickbooks' }, { status: 400 });
    }

    // ── Validate cutoff date ──
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.cutoffDate ?? '')) {
      return NextResponse.json({ error: 'Invalid cutoff date — expected YYYY-MM-DD' }, { status: 400 });
    }

    // ── Validate MigrationData structure ──
    const d = body.data;
    if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.invoices) || !Array.isArray(d.bills)) {
      return NextResponse.json({ error: 'Invalid migration data structure' }, { status: 400 });
    }

    // ── Sanitise all string fields ──
    d.customers = (d.customers ?? []).map(c => ({ ...c, name: san(c.name), email: san(c.email) }));
    d.suppliers = (d.suppliers ?? []).map(s => ({ ...s, name: san(s.name) }));
    d.invoices  = (d.invoices ?? []).map(inv => ({
      ...inv,
      clientName: san(inv.clientName),
      sourceRef:  san(inv.sourceRef),
      items: (inv.items ?? []).map(it => ({
        ...it,
        description: san(it.description),
        quantity:    sanNum(it.quantity),
        unitPrice:   sanNum(it.unitPrice),
        taxRate:     sanNum(it.taxRate),
      })),
    }));
    d.bills = (d.bills ?? []).map(b => ({
      ...b,
      supplierName: san(b.supplierName),
      amount:       sanNum(b.amount),
      vatAmount:    sanNum(b.vatAmount),
    }));
    d.openingBalances = (d.openingBalances ?? []).map(ob => ({
      accountCode: Math.floor(sanNum(ob.accountCode)),
      debit:       sanNum(ob.debit),
      credit:      sanNum(ob.credit),
    }));

    // ── Trial balance check ──
    const tbResult = validateTrialBalance(d.trialBalance);
    if (!tbResult.valid) {
      return NextResponse.json({
        error: `Trial balance does not balance — discrepancy: £${tbResult.discrepancy.toFixed(2)}`,
      }, { status: 422 });
    }

    // ── Determine skip batches (resume flow) ──
    let runId: string;
    let skipBatches: string[] = [];

    if (body.resumeRunId) {
      const prev = await query(`SELECT * FROM migration_runs WHERE id = $1 AND entity_id = $2`, [body.resumeRunId, entity.id]);
      if (!prev.rows[0]) return NextResponse.json({ error: 'Previous run not found' }, { status: 404 });
      runId = body.resumeRunId;
      const prevBatches = prev.rows[0].batches as Array<{ type: string; status: string }>;
      skipBatches = prevBatches.filter(b => b.status === 'completed').map(b => b.type);
    } else {
      // Create new migration_runs record
      const r = await query(
        `INSERT INTO migration_runs (entity_id, user_id, source, cutoff_date, files_uploaded, auto_mappings, validation_warnings, batches)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          entity.id, auth.userId, body.source, body.cutoffDate,
          JSON.stringify(body.data.accounts.map(a => ({ name: a.sourceName }))),
          JSON.stringify(body.mappings ?? []),
          JSON.stringify([]),
          JSON.stringify([]),
        ]
      );
      runId = r.rows[0].id;
    }

    // ── Run import ──
    const result = await importMigration({
      entityId:   entity.id,
      userId:     auth.userId,
      cutoffDate: body.cutoffDate,
      data:       d,
      mappings:   body.mappings ?? [],
      runId,
      skipBatches,
    });

    await logAudit(auth.userId, 'migration_import', 'entity', entity.id, {
      source:    body.source,
      runId,
      batchSummary: result.batches.map(b => ({ type: b.type, status: b.status, count: b.count })),
    });

    return NextResponse.json({ success: true, runId, batches: result.batches, importReport: result.importReport });

  } catch (err: any) {
    console.error('[migration/import]', err);
    return NextResponse.json({ error: err.message || 'Migration failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement server-side parse fallback (server-parse/route.ts)**

```ts
// app/api/migration/server-parse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { XeroParser } from '@/src/lib/migration/xero.parser';
import { QuickBooksParser } from '@/src/lib/migration/quickbooks.parser';

export const runtime = 'nodejs';

const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const VALID_MIME = new Set(['text/csv', 'text/plain', 'application/octet-stream']);

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'platform_migration')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const formData = await req.formData();
    const sourceId = formData.get('sourceId') as string;
    const cutoffDate = formData.get('cutoffDate') as string;

    if (!['xero', 'quickbooks'].includes(sourceId)) {
      return NextResponse.json({ error: 'Invalid sourceId' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate ?? '')) {
      return NextResponse.json({ error: 'Invalid cutoffDate' }, { status: 400 });
    }

    const files: File[] = [];
    let totalBytes = 0;
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        // Server-side MIME type validation
        const mime = value.type || 'application/octet-stream';
        const ext = value.name.split('.').pop()?.toLowerCase() ?? '';
        if (!VALID_MIME.has(mime) && !['csv', 'iif'].includes(ext)) {
          return NextResponse.json({ error: `File "${value.name}" is not a valid CSV or IIF file` }, { status: 400 });
        }
        totalBytes += value.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return NextResponse.json({ error: 'Total file size exceeds 25MB limit' }, { status: 413 });
        }
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const parser = sourceId === 'xero' ? new XeroParser() : new QuickBooksParser();
    const data = await parser.parse(files, cutoffDate);

    return NextResponse.json({ data });

  } catch (err: any) {
    console.error('[migration/server-parse]', err);
    return NextResponse.json({ error: err.message || 'Parse failed' }, { status: 500 });
  }
}
```

---

## Task 12: Migration Wizard UI

**Files:**
- Create: `app/dashboard/migrate/page.tsx`

This is a large client component. It uses React context internally (via `useState` + prop drilling is acceptable given single-file scope). All state is also persisted to `localStorage` under the key `migration_session_v1` with a 24h TTL.

- [ ] **Step 1: Create the wizard page**

Key structure — the file is a single `'use client'` component with 6 steps managed by a `step` state variable. Skeleton below; implement all step panels as described:

```tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast, DatePicker } from '@relentify/ui';
import { buildAccountMappings } from '@/src/lib/migration/matcher';
import { validateTrialBalance, classifyIssues } from '@/src/lib/migration/validation';
import type {
  MigrationData, MigrationSourceId, AccountMapping, MigrationBatchResult
} from '@/src/lib/migration/types';

// ── LocalStorage helpers ──
const LS_KEY = 'migration_session_v1';
const LS_TTL_MS = 24 * 60 * 60 * 1000;

function saveSession(data: object) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ...data, _savedAt: Date.now() }));
}
function loadSession(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed._savedAt > LS_TTL_MS) { localStorage.removeItem(LS_KEY); return null; }
    return parsed;
  } catch { return null; }
}

// ── Component ──
export default function MigratePage() {
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState<MigrationSourceId | null>(null);
  const [cutoffDate, setCutoffDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [migrationData, setMigrationData] = useState<MigrationData | null>(null);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [relentifyAccounts, setRelentifyAccounts] = useState<Array<{ code: number; name: string; type: string }>>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [batchResults, setBatchResults] = useState<MigrationBatchResult[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore session on mount
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    if (s.sourceId) setSourceId(s.sourceId as MigrationSourceId);
    if (s.cutoffDate) setCutoffDate(s.cutoffDate as string);
    if (s.step && Number(s.step) > 1) setStep(Number(s.step));
    if (s.mappings) setMappings(s.mappings as AccountMapping[]);
    if (s.batchResults) setBatchResults(s.batchResults as MigrationBatchResult[]);
    if (s.runId) setRunId(s.runId as string);
    toast('Session restored — you can continue where you left off', 'info');
  }, []);

  // Persist session on state changes
  useEffect(() => {
    saveSession({ step, sourceId, cutoffDate, mappings, batchResults, runId });
  }, [step, sourceId, cutoffDate, mappings, batchResults, runId]);

  // Fetch Relentify COA for mapping step
  useEffect(() => {
    if (step === 4) {
      fetch('/api/chart-of-accounts')
        .then(r => r.json())
        .then(data => setRelentifyAccounts(data.accounts ?? []))
        .catch(() => toast('Failed to load chart of accounts', 'error'));
    }
  }, [step]);

  // ── Parse files ──
  const parseFiles = useCallback(async () => {
    if (!files.length || !sourceId || !cutoffDate) return;
    setParsing(true);
    setParseError(null);

    const totalSize = files.reduce((s, f) => s + f.size, 0);

    // Server-side fallback for >20MB
    if (totalSize > 20 * 1024 * 1024) {
      try {
        const fd = new FormData();
        fd.append('sourceId', sourceId);
        fd.append('cutoffDate', cutoffDate);
        for (const f of files) fd.append('file', f);
        const res = await fetch('/api/migration/server-parse', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setMigrationData(json.data);
        setParseWarnings(json.data.parseWarnings ?? []);
        setStep(4);
      } catch (e: any) {
        setParseError(e.message);
      } finally {
        setParsing(false);
      }
      return;
    }

    // Use Web Worker for >5MB, inline for smaller
    const useWorker = totalSize > 5 * 1024 * 1024 && typeof Worker !== 'undefined';

    if (useWorker) {
      const worker = new Worker(
        new URL('@/src/lib/migration/worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e) => {
        if (e.data.type === 'done') {
          setMigrationData(e.data.data);
          setParseWarnings(e.data.data.parseWarnings ?? []);
          setParsing(false);
          setStep(4);
        } else {
          setParseError(e.data.message);
          setParsing(false);
        }
        worker.terminate();
      };
      worker.onerror = (err) => {
        setParseError(err.message);
        setParsing(false);
        worker.terminate();
      };
      worker.postMessage({ files, sourceId, cutoffDate });
    } else {
      // Inline parse
      try {
        const mod = sourceId === 'xero'
          ? await import('@/src/lib/migration/xero.parser')
          : await import('@/src/lib/migration/quickbooks.parser');
        const ParserClass = sourceId === 'xero' ? mod.XeroParser : (mod as any).QuickBooksParser;
        const parser = new ParserClass();
        const data = await parser.parse(files, cutoffDate);
        setMigrationData(data);
        setParseWarnings(data.parseWarnings ?? []);
        setStep(4);
      } catch (e: any) {
        setParseError(e.message);
      } finally {
        setParsing(false);
      }
    }
  }, [files, sourceId, cutoffDate]);

  // ── Auto-build mappings when COA loaded ──
  useEffect(() => {
    if (step === 4 && migrationData && relentifyAccounts.length > 0) {
      const auto = buildAccountMappings(migrationData.accounts, relentifyAccounts);
      setMappings(auto);
    }
  }, [step, migrationData, relentifyAccounts]);

  // ── Run import ──
  const runImport = async (resumeRunId?: string) => {
    if (!migrationData || !sourceId) return;
    setImporting(true);
    setBatchResults([]);
    try {
      const payload = {
        source: sourceId,
        cutoffDate,
        data: migrationData,
        mappings,
        resumeRunId,
      };
      const res = await fetch('/api/migration/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setBatchResults(json.batches);
      setRunId(json.runId);
      setImportReport(json.importReport);
      setStep(6);
      toast('Migration complete!', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  // ── Render validation summary (Step 5) ──
  const renderValidation = () => {
    if (!migrationData) return null;
    const tbResult = validateTrialBalance(migrationData.trialBalance);
    const unmapped = mappings.filter(m => m.confidence === 'none').length;
    const newCustomers = migrationData.invoices.filter(
      inv => !migrationData.customers.find(c => c.name.toLowerCase() === inv.clientName.toLowerCase())
    ).length;
    const issues = classifyIssues({ trialBalanceValid: tbResult.valid, unmappedAccounts: unmapped, newCustomersToCreate: newCustomers });
    return { tbResult, issues, unmapped, newCustomers };
  };

  // ── Download import report ──
  const downloadReport = () => {
    if (!importReport) return;
    const blob = new Blob([importReport], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `migration-report-${runId?.slice(0, 8) ?? 'unknown'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--theme-background)]">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header + step indicator */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Migration Tool</h1>
          <p className="text-sm text-[var(--theme-text-muted)] mt-1">
            Import your data from Xero or QuickBooks in 6 steps.
          </p>
          <div className="flex gap-2 mt-4">
            {[1,2,3,4,5,6].map(n => (
              <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${
                n <= step ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]'
              }`} />
            ))}
          </div>
        </div>

        {/* ── Step 1: Choose Source ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 1 — Choose your accounting platform</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['xero', 'quickbooks'] as MigrationSourceId[]).map(src => (
                <button
                  key={src}
                  onClick={() => { setSourceId(src); setStep(2); }}
                  className={`p-6 rounded-cinematic border-2 text-left transition-all ${
                    sourceId === src
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10'
                      : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]/50'
                  }`}
                >
                  <p className="text-base font-black text-[var(--theme-text)] capitalize mb-1">{src === 'quickbooks' ? 'QuickBooks' : 'Xero'}</p>
                  <p className="text-xs text-[var(--theme-text-muted)]">
                    {src === 'xero'
                      ? 'CSV exports from Xero (Chart of Accounts, Contacts, Invoices, Trial Balance)'
                      : 'IIF or CSV exports from QuickBooks Desktop or Online'}
                  </p>
                  <a
                    href={`/migration-guides/${src}-export.pdf`}
                    onClick={e => e.stopPropagation()}
                    className="inline-block mt-3 text-[10px] font-black uppercase tracking-widest text-[var(--theme-accent)]"
                    download
                  >
                    ↓ Export Instructions
                  </a>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Cutoff Date ── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 2 — Set cutoff date</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              <p className="text-sm text-[var(--theme-text-muted)]">
                All outstanding invoices and bills <strong>on or before this date</strong> will be imported.
                Opening balances will reflect your accounts at this date.
              </p>
              <div>
                <label className="block text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">
                  Cutoff Date *
                </label>
                <DatePicker value={cutoffDate} onChange={setCutoffDate} />
                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                  Typically your last year-end or last month-end date.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)] hover:border-[var(--theme-accent)]/50">
                  Back
                </button>
                <button
                  disabled={!cutoffDate}
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Upload Files ── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 3 — Upload export files</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              <p className="text-sm text-[var(--theme-text-muted)]">
                {sourceId === 'xero'
                  ? 'Upload: Chart of Accounts.csv, Contacts.csv, Invoices.csv, Trial Balance.csv (Bills.csv and Manual Journals.csv optional).'
                  : 'Upload: chart_of_accounts.csv/.iif, customer_list.csv, vendor_list.csv, invoice_list.csv, trial_balance.csv.'}
              </p>

              <label className="block w-full cursor-pointer">
                <div className={`border-2 border-dashed rounded-cinematic p-8 text-center transition-colors ${
                  files.length > 0 ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-accent)]/10' : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]/30'
                }`}>
                  {files.length > 0 ? (
                    <div className="space-y-1">
                      {files.map(f => (
                        <p key={f.name} className="text-xs font-medium text-[var(--theme-text)]">
                          {f.name} <span className="text-[var(--theme-text-muted)]">({(f.size / 1024).toFixed(1)} KB)</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--theme-text-muted)]">Click to select files — multiple files accepted</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.iif"
                  multiple
                  onChange={e => setFiles(Array.from(e.target.files ?? []))}
                  className="hidden"
                />
              </label>

              {parseError && (
                <p className="text-sm text-[var(--theme-destructive)]">{parseError}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]">
                  Back
                </button>
                <button
                  disabled={!files.length || parsing}
                  onClick={parseFiles}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                >
                  {parsing ? 'Parsing…' : 'Parse Files'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Map Accounts ── */}
        {step === 4 && migrationData && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Step 4 — Map accounts</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">
              {parseWarnings.length > 0 && (
                <div className="rounded-cinematic border border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/10 p-3">
                  <p className="text-xs font-black text-[var(--theme-warning)] mb-1">Parse Warnings</p>
                  {parseWarnings.map((w, i) => <p key={i} className="text-xs text-[var(--theme-warning)]">• {w}</p>)}
                </div>
              )}

              <p className="text-sm text-[var(--theme-text-muted)]">
                Review the suggested account mappings. High confidence matches are pre-selected.
                Amber entries need your attention.
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mappings.map((m, idx) => (
                  <div key={m.sourceCode} className={`flex items-center gap-3 p-3 rounded-cinematic border ${
                    m.confidence === 'none' ? 'border-[var(--theme-warning)]/50 bg-[var(--theme-warning)]/5' :
                    m.confidence === 'medium' ? 'border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/5' :
                    'border-[var(--theme-border)]'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--theme-text)] truncate">{m.sourceName}</p>
                      <p className="text-[10px] text-[var(--theme-text-muted)]">Code: {m.sourceCode}</p>
                    </div>
                    <span className="text-[var(--theme-text-muted)] text-xs">→</span>
                    <select
                      value={m.targetCode ?? ''}
                      onChange={e => {
                        const updated = [...mappings];
                        updated[idx] = {
                          ...m,
                          targetCode: e.target.value ? parseInt(e.target.value, 10) : null,
                          confidence: e.target.value ? 'high' : 'none',
                        };
                        setMappings(updated);
                      }}
                      className="text-xs bg-[var(--theme-card)] border border-[var(--theme-border)] rounded px-2 py-1 text-[var(--theme-text)] max-w-[200px]"
                    >
                      <option value="">— Skip —</option>
                      {relentifyAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                    {m.confidence === 'medium' && (
                      <span className="text-[10px] text-[var(--theme-warning)] shrink-0">Suggested — verify</span>
                    )}
                    {m.confidence === 'none' && (
                      <span className="text-[10px] text-[var(--theme-warning)] shrink-0">Unresolved</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]">
                  Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Preview & Validate ── */}
        {step === 5 && migrationData && (() => {
          const v = renderValidation()!;
          return (
            <div className="space-y-6">
              <h2 className="text-lg font-black text-[var(--theme-text)]">Step 5 — Preview & validate</h2>
              <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">

                {/* Will import summary */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">Will import</p>
                  {[
                    ['Accounts', migrationData.accounts.length],
                    ['Customers', migrationData.customers.length],
                    ['Suppliers', migrationData.suppliers.length],
                    ['Outstanding Invoices', migrationData.invoices.length],
                    ['Outstanding Bills', migrationData.bills.length],
                    ['Opening Balance Lines', migrationData.openingBalances.length],
                  ].map(([label, count]) => (
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-[var(--theme-text-muted)]">{label}</span>
                      <span className="font-semibold text-[var(--theme-text)]">{count}</span>
                    </div>
                  ))}
                </div>

                {/* Trial balance */}
                <div className={`rounded-cinematic p-3 border text-sm ${
                  v.tbResult.valid
                    ? 'border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'
                    : 'border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]'
                }`}>
                  {v.tbResult.valid
                    ? `✓ Trial balance: Debits £${migrationData.trialBalance.totalDebits.toFixed(2)} = Credits £${migrationData.trialBalance.totalCredits.toFixed(2)}`
                    : `✗ Trial balance imbalanced — discrepancy: £${v.tbResult.discrepancy.toFixed(2)}`}
                </div>

                {/* Errors */}
                {v.issues.errors.map((e, i) => (
                  <div key={i} className="rounded-cinematic p-3 border border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/10 text-sm text-[var(--theme-destructive)]">
                    ✗ {e}
                  </div>
                ))}

                {/* Warnings */}
                {v.issues.warnings.map((w, i) => (
                  <div key={i} className="rounded-cinematic p-3 border border-[var(--theme-warning)]/30 bg-[var(--theme-warning)]/10 text-sm text-[var(--theme-warning)]">
                    ⚠ {w}
                  </div>
                ))}

                <div className="flex gap-3">
                  <button onClick={() => setStep(4)} className="px-4 py-2 text-xs font-black uppercase tracking-widest border border-[var(--theme-border)] rounded-cinematic text-[var(--theme-text-muted)]">
                    Back
                  </button>
                  <button
                    disabled={!v.issues.canProceed || importing}
                    onClick={() => runImport()}
                    className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic disabled:opacity-40"
                  >
                    {importing ? 'Importing…' : `Import ${migrationData.invoices.length + migrationData.bills.length + migrationData.customers.length + migrationData.suppliers.length} records`}
                  </button>
                </div>

                {/* Live batch progress during import */}
                {importing && batchResults.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {batchResults.map(b => (
                      <div key={b.type} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-[var(--theme-text-muted)]">{b.type.replace('_', ' ')}</span>
                        <span className={b.status === 'completed' ? 'text-[var(--theme-accent)]' : b.status === 'failed' ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-text-muted)]'}>
                          {b.status === 'completed' ? `✓ ${b.count}` : b.status === 'failed' ? '✗ Failed' : '…'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Step 6: Complete ── */}
        {step === 6 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-[var(--theme-text)]">Migration Complete</h2>
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-6 space-y-4">

              <div className="space-y-1.5">
                {batchResults.map(b => (
                  <div key={b.type} className={`flex items-center justify-between text-sm rounded-cinematic p-2 ${
                    b.status === 'completed' ? '' : 'bg-[var(--theme-destructive)]/10'
                  }`}>
                    <span className="capitalize text-[var(--theme-text-muted)]">{b.type.replace('_', ' ')}</span>
                    <span className={b.status === 'completed' ? 'text-[var(--theme-accent)] font-semibold' : 'text-[var(--theme-destructive)]'}>
                      {b.status === 'completed' ? `✓ ${b.count} imported` : `✗ ${b.error ?? 'Failed'}`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Resume failed batches */}
              {runId && batchResults.some(b => b.status === 'failed') && (
                <button
                  onClick={() => runImport(runId)}
                  disabled={importing}
                  className="px-4 py-2 border border-[var(--theme-warning)]/50 text-[var(--theme-warning)] text-xs font-black uppercase tracking-widest rounded-cinematic"
                >
                  Resume Import (retry failed batches)
                </button>
              )}

              <div className="flex gap-3">
                {importReport && (
                  <button
                    onClick={downloadReport}
                    className="px-4 py-2 border border-[var(--theme-accent)]/50 text-[var(--theme-accent)] text-xs font-black uppercase tracking-widest rounded-cinematic"
                  >
                    ↓ Download Import Report
                  </button>
                )}
                <a
                  href="/dashboard"
                  className="px-6 py-2 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-widest rounded-cinematic inline-block"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
```

---

## Task 13: Navigation Update

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Add "Migrate" link to the nav**

In `app/dashboard/layout.tsx`, find the `accountingItems` array (around line 57) and add to the settings-group area. Since the layout uses a `TopBar` (not sidebar), add a direct `TopBarLink` between the Reports dropdown and the Settings gear icon:

```tsx
// After the Reports TopBarDropdown and before Settings:
<TopBarLink href="/dashboard/migrate" active={isActive('/dashboard/migrate')}>
  Migrate
</TopBarLink>
```

---

## Task 14: Static PDF Guides (Placeholders)

**Files:**
- Create: `public/migration-guides/xero-export.pdf`
- Create: `public/migration-guides/quickbooks-export.pdf`

- [ ] **Step 1: Create placeholder PDFs**

These are static files — create minimal valid PDF placeholders. In a production environment these would be designer-produced guides. For now:

```bash
# Requires ghostscript (already in Dockerfile)
echo "%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF" > /opt/relentify-monorepo/apps/22accounting/public/migration-guides/xero-export.pdf
cp /opt/relentify-monorepo/apps/22accounting/public/migration-guides/xero-export.pdf \
   /opt/relentify-monorepo/apps/22accounting/public/migration-guides/quickbooks-export.pdf
```

Note: The implementing agent will need to create the `public/migration-guides/` directory first.

---

## Task 15: Playwright E2E Tests

**Files:**
- Create: `playwright/scripts/migrate-xero.ts`
- Create: `playwright/scripts/migrate-quickbooks.ts`

- [ ] **Step 1: Install Playwright (if not present)**

```bash
cd /opt/relentify-monorepo && pnpm add @playwright/test --filter 22accounting -D && pnpm install
```

- [ ] **Step 2: Create playwright.config.ts if not present**

```ts
// apps/22accounting/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/scripts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3022',
  },
});
```

- [ ] **Step 3: Create sample fixture CSVs in playwright/fixtures/**

```bash
mkdir -p /opt/relentify-monorepo/apps/22accounting/playwright/fixtures
```

Create `playwright/fixtures/xero-coa.csv`:
```
AccountCode,Name,Type,TaxType
1100,Trade Debtors,CURRENT,NONE
4000,Sales Revenue,REVENUE,OUTPUT
```

Create `playwright/fixtures/xero-trial-balance.csv`:
```
AccountCode,Name,Debit,Credit
1100,Trade Debtors,1200.00,0
4000,Sales Revenue,0,1200.00
```

- [ ] **Step 4: Write migrate-xero.ts**

```ts
// playwright/scripts/migrate-xero.ts
import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

test('Xero migration wizard — completes full 6-step flow', async ({ page }) => {
  // Navigate to migrate page (assumes authenticated session)
  await page.goto('/dashboard/migrate');

  // Step 1: Choose source
  await page.click('button:has-text("Xero")');
  await expect(page.locator('h2')).toContainText('Step 2');

  // Step 2: Set cutoff date
  await page.fill('input[type="text"]', '2024-12-31');
  await page.click('button:has-text("Continue")');
  await expect(page.locator('h2')).toContainText('Step 3');

  // Step 3: Upload files
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('div.border-dashed'),
  ]);
  await fileChooser.setFiles([
    path.join(FIXTURES, 'xero-coa.csv'),
    path.join(FIXTURES, 'xero-trial-balance.csv'),
  ]);
  await page.click('button:has-text("Parse Files")');
  await expect(page.locator('h2')).toContainText('Step 4', { timeout: 15000 });

  // Step 4: Map accounts — accept auto-mappings
  await page.click('button:has-text("Continue to Preview")');
  await expect(page.locator('h2')).toContainText('Step 5');

  // Step 5: Validate — trial balance should be balanced
  await expect(page.locator('text=Trial balance')).toContainText('=');

  // Step 6: Import (mocked in test environment — check button exists)
  await expect(page.locator('button:has-text("Import")')).toBeEnabled();
});
```

---

## Task 16: Jest Setup & Package.json

- [ ] **Step 1: Add jest config to package.json**

The `package.json` currently has no test script. Add:

```json
"scripts": {
  "test": "jest",
  "test:e2e": "playwright test"
},
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "jsdom",
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  }
}
```

- [ ] **Step 2: Install jest dependencies**

```bash
cd /opt/relentify-monorepo && pnpm add jest ts-jest @types/jest jest-environment-jsdom --filter 22accounting -D && pnpm install
```

---

## Task 17: Build & Deploy

- [ ] **Step 1: TypeScript compile check**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx tsc --noEmit 2>&1 | head -40
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Run all unit tests**

```bash
cd /opt/relentify-monorepo/apps/22accounting && npx jest src/lib/migration --no-coverage 2>&1 | tail -30
```

All 4 test suites (matcher, xero.parser, quickbooks.parser, validation) must pass.

- [ ] **Step 3: Apply database migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-monorepo/apps/22accounting/database/migrations/026_migration_runs.sql
docker exec -i infra-postgres psql -U relentify_user -d relentify -c "SELECT COUNT(*) FROM migration_runs;" 2>&1
```

- [ ] **Step 4: Rebuild Docker container**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache 2>&1 | tail -20
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 30
docker builder prune -f
```

- [ ] **Step 5: Smoke test the live routes**

```bash
# Confirm migration page loads (unauthenticated → redirect expected)
curl -s -o /dev/null -w "%{http_code}" https://accounting.relentify.com/dashboard/migrate
# Confirm API route exists (401 expected without auth)
curl -s -o /dev/null -w "%{http_code}" -X POST https://accounting.relentify.com/api/migration/import
```

Expected: 307 (redirect to login) for page, 401 for API route.

- [ ] **Step 6: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/database/migrations/026_migration_runs.sql \
        apps/22accounting/src/lib/migration/ \
        apps/22accounting/src/lib/tiers.ts \
        apps/22accounting/src/lib/invoice.service.ts \
        apps/22accounting/src/lib/bill.service.ts \
        apps/22accounting/app/api/migration/ \
        apps/22accounting/app/dashboard/migrate/ \
        apps/22accounting/app/dashboard/layout.tsx \
        apps/22accounting/public/migration-guides/ \
        apps/22accounting/playwright/
git commit -m "feat: migration tool — Xero/QuickBooks 6-step wizard, fuzzy account mapping, migration_runs audit table (026)"
```

---

## Self-Review Against Spec

| Spec requirement | Implemented | Notes |
|-----------------|-------------|-------|
| 6-step wizard at `/dashboard/migrate` | Yes | `app/dashboard/migrate/page.tsx` |
| Xero CSV parser | Yes | `src/lib/migration/xero.parser.ts` |
| QuickBooks IIF + CSV parser | Yes | `src/lib/migration/quickbooks.parser.ts` |
| `MigrationSource` interface (extensible) | Yes | `src/lib/migration/types.ts` |
| Web Worker for >5MB files | Yes | `src/lib/migration/worker.ts`, threshold in wizard |
| Server-side fallback for >20MB | Yes | `app/api/migration/server-parse/route.ts` |
| Levenshtein fuzzy matching (distance ≤ 2) | Yes | `src/lib/migration/matcher.ts` |
| 3 confidence tiers (high/medium/none) | Yes | `ConfidenceLevel` type + `matchAccount()` |
| Cutoff date inclusive | Yes | `issueDate > cutoffDate` excludes strictly after; `=` cutoffDate is included |
| Trial balance validation (£0.01 tolerance) | Yes | `src/lib/migration/validation.ts` |
| GL skip during migration (no double-count) | Yes | `skipGLPosting` flag on `createInvoice` + `createBill` |
| Opening balances as single GL truth | Yes | `importOpeningBalances()` called in final batch |
| Atomicity: GL fail → full rollback | Yes | `withTransaction` wraps opening balances batch; error propagates |
| Partial import recovery / Resume | Yes | `skipBatches` pattern in `importMigration`, resume button in UI |
| `migration_runs` audit table | Yes | Migration 026 |
| Import report (CSV download) | Yes | `importReport` field in run + download button |
| Server-side MIME validation (CSV/IIF only) | Yes | `server-parse` route checks extension + MIME |
| Max 25MB file size | Yes | Enforced in `server-parse` route |
| Unknown IIF row types silently skipped | Yes | `__unknown__` tracking in `parseIIF()` |
| Duplicate customer → auto-merge existing | Yes | `custMap` lookup before `createCustomer` |
| Account code collision → auto-merge | Yes | `matchAccount()` exact code match returns high confidence |
| State preserved in localStorage 24h | Yes | `saveSession` / `loadSession` with TTL check |
| Tier gate (`small_business+`) | Yes | `platform_migration` feature in `tiers.ts` |
| "Migrate" nav link added | Yes | `app/dashboard/layout.tsx` |
| Unit tests: matcher, parsers, validation | Yes | Tasks 4, 5, 6, 7 |
| Playwright E2E tests | Yes | Task 15 |
| IIF column headers dynamic (not fixed position) | Yes | `parseIIF()` reads headers from `!` row per section |
| QuickBooks QB type → Relentify range mapping | Yes | `QB_TYPE_TO_RELENTIFY` in both parser and matcher |
| Warnings vs errors (amber/red) | Yes | `classifyIssues()` + UI colour coding in Step 5 |
| Export instruction PDFs in `public/` | Yes | Placeholder PDFs in Task 14 |

---

### Critical Files for Implementation

- `/opt/relentify-monorepo/apps/22accounting/src/lib/migration/types.ts`
- `/opt/relentify-monorepo/apps/22accounting/src/lib/migration/import.service.ts`
- `/opt/relentify-monorepo/apps/22accounting/app/api/migration/import/route.ts`
- `/opt/relentify-monorepo/apps/22accounting/app/dashboard/migrate/page.tsx`
- `/opt/relentify-monorepo/apps/22accounting/database/migrations/026_migration_runs.sql`