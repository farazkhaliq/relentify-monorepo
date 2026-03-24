This is the project context for Gemini.

# relentify-accounts

The main Relentify SaaS app. Accounting software for UK small businesses.
Next.js 14 app router, Postgres, Stripe Connect, Resend email, TrueLayer open banking.

Container: `relentify-accounts` on port 3012 → accounts.relentify.com
Shared DB: `infra-postgres` → relentify DB, relentify_user
Cron container: `relentify-accounts-cron-1` (Alpine, runs reminder jobs)

---

## Architecture

- **App router** — all pages under `app/dashboard/`, APIs under `app/api/`
- **Feature gating** — `lib/tiers.ts` is the single source of truth. Use `canAccess(tier, feature)` to gate
- **Services** — all DB logic lives in `lib/services/*.service.ts` — never write raw queries in routes
- **Double-entry GL** — every financial transaction posts a balanced journal entry via `postJournalEntry()` in `general_ledger.service.ts`. GL posting is non-blocking (try/catch) — the transaction still saves if GL fails. Do not bypass this.
- **Email** — Resend via `lib/email.ts`. All `from:` addresses use `invoices@relentify.com` (production domain — do not change back to resend.dev).
- **Auth** — `getAuthUser()` from `lib/auth.ts` returns JWT payload (userId, actorId, email). Does NOT include entity_id or tier — call `getActiveEntity(auth.userId)` and `getUserById(auth.userId)` separately in routes.
- **Audit** — `logAudit()` from `lib/services/audit.service.ts` — signature: `logAudit(userId, action, entityType, entityId?, metadata?)`

---

## Tier System

Defined in `lib/tiers.ts`. Never hardcode tier names in components — always use `canAccess()`.

| Tier | Key features |
|------|-------------|
| invoicing | Invoices, quotes, card payments, chart of accounts |
| sole_trader | + Bills, reports, bank reconciliation, reminders, GL/trial balance, credit notes |
| small_business | + MTD VAT, expenses, mileage, import |
| medium_business | + Custom branding, multi-currency, PO approvals, KPIs |
| corporate | + Multi-entity, intercompany, consolidated reporting, audit log |

---

## Pre-Launch Checklist — Complete

✅ = Done | 🔴 = Not done | 🟡 = Partial

Priority rationale: bugs first → foundational dependencies → core features → compliance → workflows → UI polish → advanced features.
Items higher in the list unblock items below them.

---

### 🔴 BUGS — fix before anything else

| Pri | # | St | Item |
|-----|---|----|------|
| 1 | 5 | 🔴 | **Price formatting bug** — 1 qty × 10000 = £100.00 (decimal shift in invoice line item calculation or API payload parsing). Needs live testing to confirm still present. |
| 2 | 9 | ✅ | **Team invite link broken** — already working: page at `/dashboard/team/accept` exists, email sends `https://accounts.relentify.com/dashboard/team/accept?token=…`. |
| 3 | 8 | ✅ | **Quotes — email not delivered** — fixed: `from:` was using resend.dev test domain. Now uses `invoices@relentify.com`. |
| 4 | 19 | ✅ | **Connect bank — bad request error** — Fixed: scope was `accounts balance transactions offline_access` (missing `info`, had extra `transactions`). Changed to `info accounts balance offline_access`. Added `TRUELAYER_PROVIDERS=uk-cs-mock` to .env to match sandbox provider. CLIENT_ID and AUTH_URL were already correct. |

---

### ✅ FOUNDATIONAL — unlocks many other items

| Pri | # | St | Item |
|-----|---|----|------|
| 5 | 11 | ✅ | **Suppliers page** — `/dashboard/suppliers`, full CRUD, inline creation in bills + PO forms, `SupplierCombobox` component in `@relentify/ui2`. |
| 6 | 18 | ✅ | **Remove Pay Bills / E-Banking from nav** — dead links removed from `bankingItems` in Nav.tsx. |

---

### 🔴 CORE MISSING FEATURES — needed for any paying customer

| Pri | # | St | Item |
|-----|---|----|------|
| 7 | 10 | ✅ | **Credit notes** — `/dashboard/credit-notes` list/create/detail, status flow (draft→issued→applied), void with GL reversal. DB: `credit_notes` + `credit_note_items` tables. |
| 8 | 13 | ✅ | **Bill — invoice date field** — added to bills/new form, API, and bill detail view. |
| 9 | 14 | ✅ | **Bill — Mark as Paid flow** — replaced with "Record Payment" modal: payment date, bank account (COA 1200–1299), reference. Creates `bank_transactions` record + GL entry. |
| 10 | 41 | ✅ | **Invoice — manual payment recording** — "Record Payment" modal on invoice detail: date, amount, bank account, reference. POSTs to `/api/invoices/[id]/pay`. GL: Dr Bank / Cr Debtors. |
| 11 | 16 | ✅ | **New PO — supplier selection** — `SupplierCombobox` added to PO create form with inline create modal. (Completed as part of #5.) |
| 12 | 20 | ✅ | **P&L frontend rebuild** — rebuilt to use GL fields: income by account, gross profit, overheads, net profit. CSV export. |
| 13 | 24 | ✅ | **Balance sheet** — `/dashboard/reports/balance-sheet`. Date picker + Today/Month-end/Year-end shortcuts, assets/liabilities/equity sections, net assets line, balance check warning, CSV export. Added to nav. |
| 14 | 25 | ✅ | **VAT returns** — `/dashboard/vat`. Full HMRC MTD flow: connect, obligations list, 9-box calculation, submit. Fixed entity_id scoping (was using user_id), standard VAT invoice scope (sent+paid+overdue), bills use invoice_date with due_date fallback. |
| 15 | 26 | ✅ | **Aged receivables + aged payables** — `/dashboard/reports/aged`. Two tabs, age buckets (current/30/60/90/90+), overdue highlighting, CSV export. APIs at `/api/reports/aged-receivables` + `/api/reports/aged-payables`. Added to nav. |
| 16 | 40 | ✅ | **Journal entry workflow** — `/dashboard/journals` list + `/dashboard/journals/new` form. COA account picker with search, debit/credit columns, live balance check, quick templates (accrual/prepayment/depreciation/correction), reverse button. APIs: GET/POST `/api/journals`, GET/DELETE `/api/journals/[id]`. |

---

### 🔴 FINANCIAL INTEGRITY — accounting correctness

| Pri | # | St | Item |
|-----|---|----|------|
| 17 | 29 | ✅ | **Lock periods** — `locked_through_date` on entities, `period_lock_overrides` for accountant bypass. Migration 017 applied. Settings UI Period Locks tab. `isDateLocked()` in `period_lock.service.ts`. |
| 18 | 30 | ✅ | **Block posting into previous VAT period** — enforced on all write routes: invoices (create/edit/pay/void), bills (create/edit/pay/delete), journals (create/reverse), credit notes (create/void), expenses (create/delete), mileage (create/delete). 403 `PERIOD_LOCKED` response. |
| 19 | 35 | ✅ | **Opening balances / year-end rollover** — import opening balances from Xero/QB/CSV, year-end close journal, retained earnings carry-forward. |
| 20 | 42 | 🔴 | **GL silent failure visibility** — GL posting is non-blocking (try/catch only). Add monitoring/alerting so GL failures don't go unnoticed. Currently financial transactions can save with no GL entry and no error shown. |

---

### 🔴 WORKFLOWS — makes the product usable end-to-end

| Pri | # | St | Item |
|-----|---|----|------|
| 21 | 15 | 🔴 | **Expense/mileage approval flow** — no approver. Needs claimant/approver fields, configurable mapping in settings, approve/reject actions. |
| 22 | 31 | 🔴 | **PO approval mapping** — settings: staff→manager mapping, configurable approval rules, 24 h escalation. |
| 23 | 33 | 🔴 | **Bulk-edit transactions** — select multiple bank transactions, apply same category/COA account. Critical for bank import usability. |
| 24 | 34 | 🔴 | **Receipt/invoice attachment** — upload PDF or photo against any bill, bank payment, or expense. Store in S3/R2, link to record. |
| 25 | 43 | 🔴 | **Customer statements** — PDF/email statement per customer: all invoices, payments, balance due. |
| 26 | 44 | 🔴 | **Supplier remittance advices** — PDF/email remittance when marking bill as paid. |

---

### 🔴 UI / DESIGN CONSISTENCY — one pass, do all at once to avoid rework

| Pri | # | St | Item |
|-----|---|----|------|
| 27 | 1 | 🔴 | **Dashboard** — not relentify-ui consistent. Rebuild with correct components. Goal: answer "How much money do I have?" and "What do I need to do?" instantly. Sections: (1) Real Cash Position — bank balance + unpaid invoices − bills/payroll; (2) Profit This Year — with last-year comparison + % change; (3) Alerts/Actions — overdue invoices, VAT due, uncategorised transactions; (4) Cash Forecast 30 days — projected starting cash, expected income, expected spend, projected cash. Simple, visual, actionable. |
| 28 | 2 | 🔴 | **New invoice page** — dark mode look; swap for relentify-ui components. |
| 29 | 3 | 🔴 | **New invoice — inline project creation** — can create customer inline but not project. |
| 30 | 4 | 🔴 | **Date pickers** — too basic across all forms; replace with proper component everywhere in one pass. |
| 31 | 6 | 🔴 | **Customers + new quote pages** — dark mode inconsistency; needs relentify-ui. |
| 32 | 7 | 🔴 | **Team invite page** — layout doesn't match dashboard; needs relentify-ui + View/Edit action buttons. |

---

### 🔴 PRODUCTION READINESS — required before going live

| Pri | # | St | Item |
|-----|---|----|------|
| 33 | 45 | ✅ | **Error monitoring** — Sentry `@sentry/nextjs` v8 installed. DSN in `.env`. `instrumentation.ts` + `sentry.client.config.ts` + `global-error.tsx`. Silent build (no source map upload). |
| 34 | 46 | 🔴 | **API rate limiting** — no rate limiting on any route. Brute-force and abuse possible. Add middleware (upstash/redis or simple IP throttle). |
| 35 | 47 | 🔴 | **Email deliverability** — verify SPF, DKIM, DMARC records for sending domain. Confirm Resend is configured for production domain (not sandbox). |
| 36 | 48 | 🔴 | **Company settings completeness** — verify all entities can set: registered address, VAT number, company number, bank details (for remittances). Some fields may be missing from settings UI. |
| 37 | 32 | 🔴 | **Audit trail detail** — richer before/after value capture on all significant actions (currently basic). |

---

### 🔴 TEAM / ACCOUNTANT FEATURES

| Pri | # | St | Item |
|-----|---|----|------|
| 38 | 28 | 🔴 | **Accountant signup + multi-client** — free accountant account type, invite flow creates account, client-switcher dashboard. |
| 39 | 38 | 🔴 | **Global accountant dashboard** — across all clients: unfiled VAT, reconciliation errors, missing receipts, overdue invoices. Depends on #38. |

---

### 🔴 ADVANCED / POST-LAUNCH PRIORITY

| Pri | # | St | Item |
|-----|---|----|------|
| 40 | 36 | 🔴 | **Comments/threads on transactions** — annotate records, request receipts, client replies in-system. |
| 41 | 37 | 🔴 | **Bookkeeping health score** — reconciliation %, missing receipts count, VAT errors, uncategorised transactions. |
| 42 | 39 | 🔴 | **Flexible custom reports** — custom date ranges, drill-downs, column picker, export options. |

---

### ✅ COMPLETED

| # | Item |
|---|------|
| 8 | Quotes — email fixed. `from:` changed from `resend.dev` sandbox to `invoices@relentify.com`. |
| 10 | Credit notes — `/dashboard/credit-notes` list/create/detail, void with GL reversal. `credit_notes` + `credit_note_items` tables. |
| 11 | Suppliers page — `/dashboard/suppliers`, full CRUD (list/create/edit/delete). `SupplierCombobox` in `@relentify/ui2`. |
| 12 | Bill categories → COA nominal account selector (`coa_account_id`). Fallback retained. |
| 16 | New PO — supplier selection via `SupplierCombobox` with inline create modal. |
| 17 | Projects moved to own top-level nav item. |
| 18 | Remove Pay Bills / E-Banking from nav — dead links removed from `bankingItems`. |
| 21 | General Ledger page — `/dashboard/reports/general-ledger`, date/source filter, CSV export. |
| 22 | Chart of Accounts — `/dashboard/chart-of-accounts`, COA ranges, add/deactivate. |
| 23 | Trial balance — `/dashboard/reports/trial-balance`. |
| 9 | Team invite link — already working: page + email URL were both correct. |
| 13 | Bill — invoice date field added to create form, API, and detail view. |
| 14 | Bill — Mark as Paid replaced with Record Payment modal: date, bank account (COA 1200–1299), reference. GL + bank_transactions record. |
| 19 | Connect bank — TrueLayer 400 fixed: scope changed to `info accounts balance offline_access`, added `TRUELAYER_PROVIDERS=uk-cs-mock`. |
| 20 | P&L frontend rebuilt: GL-driven income/COGS/expense rows, gross profit, net profit, CSV export. |
| 24 | Balance sheet — `/dashboard/reports/balance-sheet`. Date picker, quick shortcuts, assets/liabilities/equity sections, net assets, balance check, CSV export. |
| 26 | Aged receivables + payables — `/dashboard/reports/aged`. Two tabs, 5 age buckets, overdue highlighting, CSV export. APIs at `/api/reports/aged-receivables` + `/api/reports/aged-payables`. |
| 40 | Journal entry workflow — `/dashboard/journals` list + `/dashboard/journals/new`. COA search picker, Dr/Cr grid, live balance check, 4 templates, reverse button. |
| 41 | Invoice — Record Payment modal added: date, amount, bank account, reference. GL: Dr Bank / Cr Debtors. |
| 45 | Sentry error monitoring — `@sentry/nextjs` v8, DSN in `.env`, `instrumentation.ts`, `sentry.client.config.ts`, `global-error.tsx`. |
| 27 | Import — `/dashboard/import`, supports customers/suppliers/invoices/bills/expenses. |
| 25 | VAT returns — page was already fully built (HMRC MTD flow, 9-box calc, submit). Fixed entity_id scoping, standard VAT invoice scope (sent+paid+overdue), bills use `COALESCE(invoice_date, due_date)`. |
| 29 | Lock periods — `locked_through_date` on entities, `period_lock_overrides` for accountant bypass. Migration 017. `period_lock.service.ts`. Settings UI Period Locks tab with lock/unlock and override management. |
| 30 | Block posting — 403 `PERIOD_LOCKED` enforcement on all write routes (invoices, bills, journals, credit notes, expenses, mileage). `usePeriodLock` hook on create forms. `PeriodLockedModal` on detail pages. |
| 35 | Opening balances / year-end rollover — `/dashboard/import` opening_balances tab with XLSX template download + upload. Year-end close in Settings → Period Locks tab. Services: `opening_balance.service.ts`, `year_end.service.ts`. Migration 018 (`last_fy_end_date` on entities). |

---

## Feature Build Status (roadmap)

### ✅ Complete
- **v0.1** Invoicing, quotes, QR code payments, Stripe card payments, accountant access
- **v0.2** Bills, cashflow, performance graphs, bank reconciliation (TrueLayer), payment reminders cron
- **v0.3** HMRC MTD VAT submission, granular role-based permissions (team), expenses & mileage, mismatch flagging
- **v0.4** KPI analysis (`/dashboard/reports/kpi`)
- **v0.5** Audit log, multi-entity, intercompany, consolidated dashboard, 90-day cashflow forecast
- **v0.5** Excel/CSV import — `/dashboard/import`
- **v0.6** Project tracking, Purchase order approvals
- **v0.6** Chart of Accounts + Double-Entry GL (migrations 013–015, new services, new pages)
- **v0.6** Suppliers page, Credit notes, nav cleanup

---

## GL / Chart of Accounts

**Migrations applied:** 013 (chart_of_accounts), 014 (journal_entries + journal_lines), 015 (coa_account_id on bills/expenses/mileage_claims), 016 (credit_notes + credit_note_items), 017 (period_locks: `locked_through_date` on entities, `period_lock_history`, `period_lock_overrides`)

**COA ranges:** ASSET 1000–1999 | LIABILITY 2000–2999 | EQUITY 3000–3999 | INCOME 4000–4999 | COGS 5000–6999 | EXPENSE 7000–9998 | SUSPENSE 9999

**GL posting rules:**

| Event | Debit | Credit |
|-------|-------|--------|
| Invoice created | 1100 Debtors — total | 4000 Sales — subtotal + 2202 VAT — tax |
| Invoice paid | 1200 Bank | 1100 Debtors |
| Invoice voided | reversal of original entry | |
| Credit note issued | 4000 Sales — subtotal + 2202 VAT — tax | 1100 Debtors — total |
| Credit note voided | reversal of credit note entry | |
| Bill created | [coa_account_id or category→code fallback] + 1201 VAT Input | 2100 Creditors |
| Bill paid | 2100 Creditors | 1200 Bank |
| Expense | [coa_account_id or fallback] | 2110 Employee Reimb. |
| Mileage | 7304 Motor (or coa_account_id) | 2110 Employee Reimb. |

**Historical data:** 7 existing entities seeded with full UK COA (42 accounts) via SQL. Pre-existing invoices/bills do NOT have journal entries — new transactions only.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/tiers.ts` | Feature → tier mapping. Single source of truth. |
| `lib/services/chart_of_accounts.service.ts` | COA CRUD, seed, range validation. `getAccountByCode()` exported here. |
| `lib/services/general_ledger.service.ts` | postJournalEntry, reverseJournalEntry, trial balance, P&L, balance sheet, line builders |
| `lib/services/invoice.service.ts` | Invoice CRUD + GL posting |
| `lib/services/bill.service.ts` | Bills + GL posting |
| `lib/services/credit_note.service.ts` | Credit notes CRUD + GL posting + void |
| `lib/services/expense.service.ts` | Expenses + mileage + GL posting |
| `lib/services/entity.service.ts` | Entity management — seeds COA on creation. `getActiveEntity(userId)` used in all routes. |
| `lib/services/user.service.ts` | `getUserById(userId)` — returns user with `.tier` for `canAccess()` checks |
| `lib/services/supplier.service.ts` | Supplier CRUD |
| `lib/services/report.service.ts` | Legacy P&L/cashflow (still used for dashboard widgets) |
| `lib/services/audit.service.ts` | `logAudit(userId, action, entityType, entityId?, metadata?)` |
| `lib/services/openbanking.service.ts` | TrueLayer bank connection + sync |
| `lib/email.ts` | All transactional emails. All `from:` use `invoices@relentify.com`. |
| `lib/stripe.ts` | Stripe Connect checkout, webhooks |
| `lib/auth.ts` | Auth helpers. `getAuthUser()` returns JWT payload only — no entity_id or tier. |
| `lib/db.ts` | Postgres query wrapper |
| `lib/services/period_lock.service.ts` | `isDateLocked(entityId, date, userId)`, `lockPeriod()`, `unlockPeriod()`, override grant/revoke |
| `lib/hooks/usePeriodLock.ts` | Client hook — fetches earliest open date, provides `isDateLocked()` + `lockedMessage()` for form date inputs |
| `lib/period-lock-helpers.ts` | `parsePeriodLockedResponse(res)` — parses 403 PERIOD_LOCKED from any fetch response |
| `components/PeriodLockedModal.tsx` | Modal shown when a write is blocked by period lock; shows locked-through date + earliest open date |

THE GOLD STANDARD: Structural Hierarchy
Rule of Origin: If a component or style exists in @relentify/ui2, it is forbidden to exist within this repository.

Directory | Enforcement Protocol
-- | --
/src/app | Application Domain: Routes and business logic only. No primitive UI definitions.
/src/components/layout | Layout Integration: Must consume <NavShell />, <ThemeProvider />, and <RegionProvider /> from @relentify/ui2. No local Sidebar/TopBar logic.
/src/components/ui | The Exclusion Zone: This folder must be EMPTY of any atoms (Buttons, Inputs, Cards). Local components here are only permitted if they are complex, app-specific organisms that cannot be found in the UI2 inventory.
/src/hooks | State Consumption: Use @relentify/ui2 hooks. Local hooks are only for unique app-specific data fetching.
/src/styles | The Bridge: globals.css must only contain an @import of the UI2 stylesheet and app-specific overrides. Zero hardcoded hex/px values.

🎨 THE TOKEN MAP: Design DNA
Absolute Enforcement: Any value not derived from these CSS variables is a migration failure.
Color Palette: --theme-primary, --theme-accent, --theme-background, --theme-card, --theme-border, --theme-text.
Shadows: .shadow-cinematic (Must be inherited via the UI2 global CSS). Manual Tailwind shadows (e.g., shadow-xl) are illegal.
Geometry: .rounded-cinematic. Manual radii (e.g., rounded-2xl) are illegal.
Surfaces: .glass-panel. Manual backdrop-blurs are illegal.
Typography: Inter (Sans), JetBrains Mono (Mono), Playfair Display (Serif).

🛠️ THE FUNCTIONAL BLUEPRINT
1. The "Consumer" Protocol (No Local Shadows)
Dependency Rule: package.json must list @relentify/ui2.
Deletion Rule: Before any code change, the AI must search for local files that duplicate UI2 atoms. Action: Delete local file -> Update Import to @relentify/ui2.
Entry Point Rule: main.tsx or layout.tsx must import @relentify/ui2/dist/styles.css (or the package equivalent). If styles are missing, fix the import; do not recreate the CSS locally.

2. Strict Hardcoding Lockdown
To achieve a "Perfect Mirror," the following replacements are non-negotiable:
Zero Hex/RGBA: All color classes must use CSS variables.
Wrong: bg-[#10B981] or bg-green-500.
Right: bg-[var(--theme-accent)].
Zero Arbitrary Spacing: No p-[20px]. Use standard Tailwind spacing scale or UI2 defined variables.

Class Replacement Table:
shadow-sm/md/lg/xl/2xl $\rightarrow$ shadow-cinematic
rounded-lg/xl/2xl/3xl $\rightarrow$ rounded-cinematic
bg-white/bg-black $\rightarrow$ bg-[var(--theme-background)] or bg-[var(--theme-card)]

3. The Forensic Verification Step
Grep Audit: Search for relentify-ui (v1). Any match = FAILED.
Collision Audit: If src/components/ui/Button.tsx exists = FAILED.
Hardcode Audit: If any .tsx contains # or px (outside of rare SVGs) = FAILED.
