# Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dashboard with a focused, visually striking page that answers "How much money do I have?" and "What do I need to do?" instantly.

**Architecture:** Two files only — a new `dashboard.service.ts` aggregates all data in a single `Promise.all`, and `app/dashboard/page.tsx` is fully rewritten as a server component that calls it. No new routes, no migrations, no new UI components.

**Tech Stack:** Next.js 15 app router (server component), Postgres via `query()` wrapper, `@relentify/ui` components, `getProfitAndLoss()` from `general_ledger.service.ts`, Tailwind CSS variables only.

**Spec:** `docs/superpowers/specs/2026-03-17-dashboard-rebuild-design.md`

---

## Chunk 1: Dashboard Service

### Task 1: Create `dashboard.service.ts`

**Files:**
- Create: `src/lib/dashboard.service.ts`

This service runs all dashboard queries in a single `Promise.all` and returns a typed result. It does not call external APIs. `getProfitAndLoss` is only called when `hasReports` is true (passed by the caller).

- [ ] **Step 1: Create the file with FY date helpers and the full service function**

```typescript
// src/lib/dashboard.service.ts
import { query } from '@/src/lib/db';
import { getProfitAndLoss } from '@/src/lib/general_ledger.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns the start of the current financial year as an ISO date string.
 *  Uses last_fy_end_date + 1 day. Falls back to Jan 1 of current year. */
export function getFYStart(lastFYEndDate: string | null): string {
  if (lastFYEndDate) {
    const d = new Date(lastFYEndDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return `${new Date().getFullYear()}-01-01`;
}

/** Returns a label like "JAN–MAR" for the range fyStart → today. */
export function getPeriodLabel(fyStart: string): string {
  const start = new Date(fyStart);
  const end = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const s = months[start.getMonth()];
  const e = months[end.getMonth()];
  return s === e ? s : `${s}–${e}`;
}

/** Shifts a YYYY-MM-DD date back by exactly one year. */
export function shiftYearBack(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── types ─────────────────────────────────────────────────────────────────────

export interface DashboardData {
  // Net position
  bankBalance: number;
  hasBankConnection: boolean;
  totalReceivables: number;
  totalPayables: number;
  // Profit (only populated when hasReports=true)
  profitYTD: number;
  profitSamePeriodLastYear: number;
  profitPeriodLabel: string;
  fyStart: string;
  // Forecast (only populated when hasReports=true)
  forecastIncome: number;
  forecastSpend: number;
  // Alerts
  overdueInvoiceCount: number;
  billsDueSoonCount: number;
  unmatchedTxCount: number;
}

// ─── main function ─────────────────────────────────────────────────────────────

export async function getDashboardData(
  userId: string,
  entityId: string,
  opts: { hasReports: boolean; lastFYEndDate: string | null }
): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const fyStart = getFYStart(opts.lastFYEndDate);
  const periodLabel = getPeriodLabel(fyStart);

  // All base queries run in parallel
  const [
    bankRow,
    receivablesRow,
    payablesRow,
    overdueRow,
    billsDueRow,
    unmatchedRow,
    forecastIncomeRow,
    forecastSpendRow,
  ] = await Promise.all([
    // Bank balance from bank_connections (TrueLayer synced balance)
    query(
      `SELECT COALESCE(SUM(balance), 0) AS balance,
              COUNT(*) > 0 AS has_connection
       FROM bank_connections
       WHERE user_id = $1 AND entity_id = $2`,
      [userId, entityId]
    ),
    // Total receivables: sent + overdue invoices
    query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM invoices
       WHERE user_id = $1 AND entity_id = $2 AND status IN ('sent','overdue')`,
      [userId, entityId]
    ),
    // Total payables: unpaid bills
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM bills
       WHERE user_id = $1 AND entity_id = $2 AND status = 'unpaid'`,
      [userId, entityId]
    ),
    // Overdue invoice count
    query(
      `SELECT COUNT(*) AS count
       FROM invoices
       WHERE user_id = $1 AND entity_id = $2 AND status = 'overdue'`,
      [userId, entityId]
    ),
    // Bills due within 7 days (unpaid, not yet past due — lower-bounded by today)
    query(
      `SELECT COUNT(*) AS count
       FROM bills
       WHERE user_id = $1 AND entity_id = $2
         AND status = 'unpaid'
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in7Days]
    ),
    // Unmatched bank transactions
    query(
      `SELECT COUNT(*) AS count
       FROM bank_transactions
       WHERE user_id = $1 AND entity_id = $2 AND status = 'unmatched'`,
      [userId, entityId]
    ),
    // Forecast: invoices due in next 30 days
    query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM invoices
       WHERE user_id = $1 AND entity_id = $2
         AND status IN ('sent','overdue')
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in30Days]
    ),
    // Forecast: bills due in next 30 days
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM bills
       WHERE user_id = $1 AND entity_id = $2
         AND status = 'unpaid'
         AND due_date >= $3 AND due_date <= $4`,
      [userId, entityId, today, in30Days]
    ),
  ]);

  const bankBalance = parseFloat(bankRow.rows[0]?.balance ?? '0');
  const hasBankConnection = bankRow.rows[0]?.has_connection === true || bankRow.rows[0]?.has_connection === 't';

  // Profit: only fetch if caller has real_time_reports
  let profitYTD = 0;
  let profitSamePeriodLastYear = 0;

  if (opts.hasReports) {
    const priorStart = shiftYearBack(fyStart);
    const priorEnd = shiftYearBack(today);

    const [currentPnL, priorPnL] = await Promise.all([
      getProfitAndLoss(entityId, fyStart, today),
      getProfitAndLoss(entityId, priorStart, priorEnd),
    ]);

    profitYTD = currentPnL.netProfit;
    profitSamePeriodLastYear = priorPnL.netProfit;
  }

  return {
    bankBalance,
    hasBankConnection,
    totalReceivables: parseFloat(receivablesRow.rows[0]?.total ?? '0'),
    totalPayables: parseFloat(payablesRow.rows[0]?.total ?? '0'),
    profitYTD,
    profitSamePeriodLastYear,
    profitPeriodLabel: periodLabel,
    fyStart,
    forecastIncome: parseFloat(forecastIncomeRow.rows[0]?.total ?? '0'),
    forecastSpend: parseFloat(forecastSpendRow.rows[0]?.total ?? '0'),
    overdueInvoiceCount: parseInt(overdueRow.rows[0]?.count ?? '0', 10),
    billsDueSoonCount: parseInt(billsDueRow.rows[0]?.count ?? '0', 10),
    unmatchedTxCount: parseInt(unmatchedRow.rows[0]?.count ?? '0', 10),
  };
}
```

- [ ] **Step 2: Verify the file exists and has no TypeScript syntax errors**

```bash
cd /opt/relentify-monorepo
pnpm --filter 22accounting exec tsc --noEmit 2>&1 | grep dashboard.service
```

Expected: no output (no errors in the new file). Ignore pre-existing errors in other files.

- [ ] **Step 3: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/src/lib/dashboard.service.ts
git commit -m "feat(22accounting): add dashboard.service.ts with getDashboardData"
```

---

## Chunk 2: Dashboard Page Rewrite

### Task 2: Rewrite `app/dashboard/page.tsx`

**Files:**
- Modify: `apps/22accounting/app/dashboard/page.tsx`

Full rewrite. Server component. Four visual sections: page header, net position hero, profit+forecast row, alerts strip.

- [ ] **Step 1: Replace the entire file**

```tsx
// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess, type Tier } from '@/src/lib/tiers';
import { getDashboardData } from '@/src/lib/dashboard.service';
import { PageHeader, Card, CardContent, Button } from '@relentify/ui';
import UpgradeBanner from '@/src/components/UpgradeBanner';
import { TIER_CONFIG } from '@/src/lib/tiers';
import { ArrowRight, Landmark, TrendingUp, TrendingDown, AlertTriangle, FileX, CreditCard } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(n);
}

function pct(current: number, prior: number): string | null {
  if (prior === 0) return null;
  const p = ((current - prior) / Math.abs(prior)) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

// ─── sub-components ────────────────────────────────────────────────────────────

function SubFigure({
  label,
  value,
  href,
  dim,
}: {
  label: string;
  value: string;
  href: string;
  dim?: boolean;
}) {
  return (
    <Link href={href} className="no-underline group flex-1 min-w-0">
      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-1">
        {label}
      </p>
      <p className={`text-xl font-black truncate transition-opacity ${dim ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text)] group-hover:text-[var(--theme-accent)]'}`}>
        {value}
      </p>
    </Link>
  );
}

function AlertPill({
  count,
  label,
  href,
  icon: Icon,
}: {
  count: number;
  label: string;
  href: string;
  icon: React.ElementType;
}) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="no-underline inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] hover:border-[var(--theme-accent)]/50 hover:bg-[var(--theme-accent)]/5 transition-all group"
    >
      <Icon size={13} className="text-[var(--theme-destructive)] shrink-0" />
      <span className="text-[11px] font-black text-[var(--theme-text)] tabular-nums">
        {count}
      </span>
      <span className="text-[11px] font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <ArrowRight size={11} className="text-[var(--theme-text-dim)] group-hover:text-[var(--theme-accent)] transition-colors shrink-0" />
    </Link>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const _sp = await searchParams;
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const [entity, user] = await Promise.all([
    getActiveEntity(auth.userId),
    getUserById(auth.userId),
  ]);

  if (!entity) redirect('/onboarding');

  const tier = (user?.tier as Tier) || 'invoicing';
  const hasReports = canAccess(tier, 'real_time_reports');

  const data = await getDashboardData(auth.userId, entity.id, {
    hasReports,
    lastFYEndDate: entity.last_fy_end_date,
  });

  const netPosition = data.bankBalance + data.totalReceivables - data.totalPayables;
  const netPositiveClass = netPosition >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';

  const profitPositiveClass = data.profitYTD >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';
  const forecastEnd = data.bankBalance + data.forecastIncome - data.forecastSpend;
  const forecastEndClass = forecastEnd >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]';

  const changeLabel = pct(data.profitYTD, data.profitSamePeriodLastYear);
  const changePositive = data.profitYTD >= data.profitSamePeriodLastYear;

  const showAlerts =
    data.overdueInvoiceCount > 0 ||
    data.billsDueSoonCount > 0 ||
    (data.hasBankConnection && data.unmatchedTxCount > 0);

  const tierLabel = TIER_CONFIG[tier]?.label || tier;

  return (
    <main className="space-y-8">
      {_sp.upgraded === 'true' && <UpgradeBanner tierLabel={tierLabel} />}

      <PageHeader title="Dashboard" />

      {/* ── 1. Net Position Hero ─────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-2">
            Net Position
          </p>
          <p className={`text-5xl sm:text-6xl font-black tracking-tight mb-8 ${netPositiveClass}`}>
            {fmt(netPosition)}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-0 sm:divide-x sm:divide-[var(--theme-border)]">
            {/* Bank */}
            <div className="sm:pr-8 flex-1 min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-1 flex items-center gap-1.5">
                <Landmark size={10} className="opacity-60" /> Bank
              </p>
              {data.hasBankConnection ? (
                <Link href="/dashboard/banking" className="no-underline group">
                  <p className="text-xl font-black text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors truncate">
                    {fmt(data.bankBalance)}
                  </p>
                </Link>
              ) : (
                <div>
                  <p className="text-xl font-black text-[var(--theme-text-dim)]">—</p>
                  <Link
                    href="/dashboard/banking"
                    className="no-underline text-[10px] font-bold text-[var(--theme-accent)] uppercase tracking-wider hover:underline"
                  >
                    Connect bank →
                  </Link>
                </div>
              )}
            </div>

            {/* Owed To You */}
            <div className="sm:px-8 flex-1 min-w-0">
              <SubFigure
                label="Owed To You"
                value={fmt(data.totalReceivables)}
                href="/dashboard/invoices?filter=outstanding"
              />
            </div>

            {/* You Owe */}
            <div className="sm:pl-8 flex-1 min-w-0">
              <SubFigure
                label="You Owe"
                value={fmt(data.totalPayables)}
                href="/dashboard/bills"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Profit + Forecast Row ─────────────────────────────────────── */}
      {hasReports ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit */}
          <Card>
            <CardContent className="p-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-2">
                Profit — {data.profitPeriodLabel}
              </p>
              <p className={`text-4xl font-black tracking-tight mb-4 ${profitPositiveClass}`}>
                {fmt(data.profitYTD)}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-[var(--theme-text-muted)]">
                  vs {fmt(data.profitSamePeriodLastYear)} last year
                </p>
                {changeLabel && (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      changePositive
                        ? 'text-[var(--theme-accent)] border-[var(--theme-accent)]/30 bg-[var(--theme-accent)]/5'
                        : 'text-[var(--theme-destructive)] border-[var(--theme-destructive)]/30 bg-[var(--theme-destructive)]/5'
                    }`}
                  >
                    {changeLabel}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 30-day Forecast */}
          <Card>
            <CardContent className="p-8">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-6">
                30-day Forecast
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Start */}
                <div className="text-center">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1">Start</p>
                  <p className="text-lg font-black text-[var(--theme-text)]">{fmt(data.bankBalance)}</p>
                </div>

                <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 mt-3" />

                {/* Income */}
                <div className="text-center">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1">+ Income</p>
                  <p className="text-lg font-black text-[var(--theme-accent)]">+{fmt(data.forecastIncome)}</p>
                </div>

                <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 mt-3" />

                {/* Spend */}
                <div className="text-center">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1">− Spend</p>
                  <p className="text-lg font-black text-[var(--theme-destructive)]">-{fmt(data.forecastSpend)}</p>
                </div>

                <ArrowRight size={14} className="text-[var(--theme-text-dim)] shrink-0 mt-3" />

                {/* End */}
                <div className="text-center">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text-dim)] mb-1">End</p>
                  <p className={`text-2xl font-black ${forecastEndClass}`}>{fmt(forecastEnd)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Upgrade prompt — invoicing tier */
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)] mb-1">
                Profit & Forecast
              </p>
              <p className="text-sm font-bold text-[var(--theme-text-muted)]">
                Upgrade to Sole Trader to unlock profit tracking and 30-day cash forecasting.
              </p>
            </div>
            <Link href="/dashboard/settings?tab=billing" className="no-underline shrink-0">
              <Button variant="outline" size="sm" className="uppercase tracking-widest text-[10px] font-black whitespace-nowrap">
                Upgrade →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── 3. Alerts ────────────────────────────────────────────────────── */}
      {showAlerts && (
        <div className="flex flex-wrap gap-3">
          <AlertPill
            count={data.overdueInvoiceCount}
            label="overdue invoice"
            href="/dashboard/invoices?filter=overdue"
            icon={FileX}
          />
          <AlertPill
            count={data.billsDueSoonCount}
            label="bill due soon"
            href="/dashboard/bills"
            icon={CreditCard}
          />
          {data.hasBankConnection && (
            <AlertPill
              count={data.unmatchedTxCount}
              label="unmatched transaction"
              href="/dashboard/banking"
              icon={AlertTriangle}
            />
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check the page**

```bash
cd /opt/relentify-monorepo
pnpm --filter 22accounting exec tsc --noEmit 2>&1 | grep -E "dashboard|error TS" | head -20
```

Expected: no errors referencing `dashboard/page.tsx` or `dashboard.service.ts`.

- [ ] **Step 3: Build the container**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache 2>&1 | tail -20
```

Expected: build completes with `Successfully built` or `exporting to image`. If it fails, check output for TypeScript or import errors and fix before continuing.

- [ ] **Step 4: Start and verify**

```bash
docker compose -f apps/22accounting/docker-compose.yml up -d
sleep 5
docker logs 22accounting --tail 30
```

Expected: no crash, no unhandled errors. The app is up on port 3022.

- [ ] **Step 5: Clean build cache**

```bash
docker builder prune -f
```

- [ ] **Step 6: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/app/dashboard/page.tsx
git commit -m "feat(22accounting): rebuild dashboard — net position hero, profit, forecast, alerts"
```

---

## Chunk 3: CLAUDE.md Update

### Task 3: Mark Priority 5 item 1 done

**Files:**
- Modify: `apps/22accounting/CLAUDE.md`

- [ ] **Step 1: Update the checklist**

In `apps/22accounting/CLAUDE.md`, change the Priority 5 table entry for item 1:

Find:
```
| 1 | **Dashboard rebuild** — answer "How much money do I have?" and "What do I need to do?" instantly. Sections: (1) Real Cash Position — bank balance + unpaid invoices − bills; (2) Profit This Year — vs last year + % change; (3) Alerts/Actions — overdue invoices, VAT due, uncategorised transactions; (4) 30-day cash forecast — projected start, income, spend, end cash. |
```

Replace with:
```
| 1 | ✅ **Dashboard rebuild** — net position hero, profit YTD vs prior year, 30-day forecast, alerts strip. |
```

- [ ] **Step 2: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/CLAUDE.md
git commit -m "docs(22accounting): mark dashboard rebuild complete in CLAUDE.md"
```
