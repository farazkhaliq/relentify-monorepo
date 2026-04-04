# Dashboard Rebuild — Design Spec

**Date:** 2026-03-17
**App:** 22accounting
**Status:** Approved

---

## Overview

Rebuild the dashboard to answer two questions instantly:
1. **How much money do I have?**
2. **What do I need to do?**

Remove the recent invoices table and the "SYSTEM OVERVIEW" supertitle. The page is focused, data-dense, and visually striking.

---

## Layout (top to bottom)

1. Page header — "Dashboard", no supertitle
2. Net Position Hero
3. Profit + 30-day Forecast (two-column row, gated)
4. Alerts strip (hidden if all zero)

---

## Section 1 — Net Position Hero

A full-width card with:

- **Label:** `NET POSITION` — monospace, uppercase, dim
- **Primary figure:** `bankBalance + totalReceivables − totalPayables` — large, bold, `--theme-accent` if ≥ 0, `--theme-destructive` if < 0
- **Three sub-figures** in a row below:
  - **Bank** — links to `/dashboard/banking`
  - **Owed To You** — sum of invoices where `status IN ('sent','overdue')` — links to `/dashboard/invoices?filter=outstanding`
  - **You Owe** — sum of bills where `status = 'unpaid'` — links to `/dashboard/bills`

**No bank connection:** Bank sub-figure shows `—` with a small inline "Connect bank →" link to `/dashboard/banking`. Net position is calculated as `0 + totalReceivables − totalPayables`.

---

## Section 2 — Profit & Forecast Row

Two equal-width cards. Both gated to `sole_trader+` via the `real_time_reports` feature (`canAccess(tier, 'real_time_reports')`). Lower tiers see a single-card upgrade prompt spanning the full row. Note: `cashflow_forecast` is corporate-only in `tiers.ts` — do not use it here; `real_time_reports` is the correct gate for both cards.

### Profit Card

- **Label:** `PROFIT [PERIOD]` e.g. `PROFIT JAN–MAR 2026`
- **Period:** From the start of the current financial year to today. FY start is derived from `entity.last_fy_end_date + 1 day`. **Fallback:** if `last_fy_end_date` is null, use 1 January of the current calendar year.
- **Primary figure:** Net profit for the period (income − expenses), GL-driven via `getProfitAndLoss(entityId, from, to)` from `general_ledger.service.ts`
- **Comparison:** Same calendar period last year (e.g. Jan 1–Mar 17 2025), also via `getProfitAndLoss()`. Shown as `vs £X last year` + a `+N%` / `−N%` badge

### 30-day Forecast Card

A linear flow: **Start → + Income → − Spend → End**

- **Start:** `bankBalance` (0 if no bank connection)
- **Income:** Sum of `invoices` where `status IN ('sent','overdue')` and `due_date` between today and today + 30 days
- **Spend:** Sum of `bills` where `status = 'unpaid'` and `due_date` between today and today + 30 days
- **End:** Start + Income − Spend, color-coded (`--theme-accent` if ≥ 0, `--theme-destructive` if < 0)

---

## Section 3 — Alerts Strip

A horizontal row of action pills. Each pill: count badge + label + `→` link. Navigates to the relevant page.

| Alert | Condition to show | Destination |
|---|---|---|
| `N overdue invoices` | `overdueInvoiceCount > 0` | `/dashboard/invoices?filter=overdue` |
| `N bills due soon` | `billsDueSoonCount > 0` (due ≤ 7 days, status=unpaid) | `/dashboard/bills` |
| `N unmatched transactions` | `unmatchedTxCount > 0` AND `hasBankConnection` | `/dashboard/banking` — query `WHERE status = 'unmatched'` |

- VAT alert is **excluded** — requires a live HMRC API call with no local cache; adds unreliable network dependency to every dashboard load. Can be added in a future pass with a local `vat_obligations` cache.
- If **all alerts are zero**, the section is hidden entirely.
- Pills are ordered by urgency: overdue invoices first.
- Each pill is a full `Link` — clicking navigates to the filtered list where the user can take action.

---

## Data: `getDashboardData(userId, entityId)`

New function in a new file: **`src/lib/dashboard.service.ts`**

`entityId` is **required** — the caller (page.tsx) fetches it via `getActiveEntity(userId)` before calling this function, consistent with all other service patterns in the codebase. The function runs all queries in a single `Promise.all`. It does not call external APIs.

```typescript
export async function getDashboardData(userId: string, entityId: string): Promise<{
  // Net position
  bankBalance: number           // SUM(balance) FROM bank_connections — 0 if no connection
  hasBankConnection: boolean    // whether any bank_connection row exists for this user/entity
  totalReceivables: number      // SUM(total) WHERE status IN ('sent','overdue')
  totalPayables: number         // SUM(amount) WHERE status='unpaid' in bills

  // Profit (sole_trader+ only — caller skips if not gated)
  profitYTD: number
  profitSamePeriodLastYear: number
  profitPeriodLabel: string     // e.g. "JAN–MAR"
  fyStart: string               // ISO date — FY start derived from last_fy_end_date or Jan 1

  // Forecast (sole_trader+ only)
  forecastIncome: number        // invoices due in next 30 days
  forecastSpend: number         // bills due in next 30 days

  // Alerts
  overdueInvoiceCount: number
  billsDueSoonCount: number     // unpaid, due_date within 7 days
  unmatchedTxCount: number      // bank_transactions status='pending' (0 if no bank connection)
}>
```

### Bank balance source

`bankBalance` = `SELECT COALESCE(SUM(balance), 0) FROM bank_connections WHERE user_id=$1 [AND entity_id=$2]` — matches the pattern in `cashflow.service.ts`. This uses TrueLayer's synced balance, not a derivation from transaction rows.

### Profit source

`profitYTD` and `profitSamePeriodLastYear` are derived from `getProfitAndLoss(entityId, from, to)` in `general_ledger.service.ts` — **not** from `getPnLSummary()` in `report.service.ts` (legacy, known inaccuracies). Two calls are made: one for current period, one for the same period last year. Function signature: `getProfitAndLoss(entityId: string, from: string, to: string)`.

---

## Page Implementation

`app/dashboard/page.tsx`:

1. Get auth → redirect if not logged in
2. `Promise.all([getActiveEntity, getUserById])` → get `entityId`, `tier`
3. Call `getDashboardData(userId, entityId)` — always
4. If `canAccess(tier, 'real_time_reports')`: call `getIncomeStatement` twice (YTD + prior period) inside `getDashboardData` (or pass flag to service)
5. Render sections in order

The upgrade banner (for `?upgraded=true`) is kept as-is above the page header.

---

## Tier Gating

| Feature | Minimum tier | Lower tier sees |
|---|---|---|
| Net position hero | all | full section |
| Alerts strip | all | full section |
| Profit card | `sole_trader` | upgrade prompt card |
| 30-day forecast | `sole_trader` | upgrade prompt card (combined with profit) |

---

## Styling Notes

- All colours via CSS variables — no hardcoded Tailwind colour classes
- Primary numbers: `text-4xl font-black` or larger
- Section labels: `text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--theme-text-dim)]`
- Positive values: `text-[var(--theme-accent)]`
- Negative / danger values: `text-[var(--theme-destructive)]`
- Cards: `@relentify/ui` `Card` + `CardContent`
- Alert pills: styled as bordered pill buttons with count badge, full `Link` wrapper
- All navigation: `Link` from `next/link`

---

## Files Changed

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Full rewrite |
| `src/lib/dashboard.service.ts` | New file — `getDashboardData()` |

No new routes, no migrations, no new UI components.
