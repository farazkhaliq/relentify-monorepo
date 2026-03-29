# PLATFORM CONTEXT (INHERITED FROM MONOREPO)

This app is part of the Relentify monorepo.

You MUST follow all platform-level rules defined in the monorepo claude.md, especially:

- All UI must come from @relentify/ui (no local UI components)
- No hardcoded colours or styling outside theme tokens
- Shared auth, database, and architecture must be respected
- Apps must feel like a single unified product

If there is any conflict between this file and the monorepo claude.md:
→ The monorepo claude.md takes precedence

---

## PLATFORM THINKING REQUIREMENT

When implementing features in this app, always consider:

- Could this logic be reused by other apps (CRM, inventory, etc.)?
- Should this live in a shared package instead of this app?
- Does this break consistency across the platform?

Avoid app-specific hacks that limit reuse.

---

## SCOPE

This file contains:
- App-specific architecture
- Accounting domain rules
- Feature roadmap and implementation status

It does NOT override platform-wide standards.

---

# 22accounting

The main Relentify SaaS app. Accounting software for UK small businesses.
Next.js 15 app router, Postgres, Stripe Connect, Resend email, TrueLayer open banking.

Container: `22accounting` on port 3022 → accounting.relentify.com
Shared DB: `infra-postgres` → relentify DB, relentify_user
Monorepo: `/opt/relentify-monorepo/apps/22accounting/`
Cron container: none currently — escalation cron runs via `/api/cron/po-escalation` (HTTP, protected by `x-cron-secret`)

---

## Architecture

- **App router** — all pages under `app/dashboard/`, APIs under `app/api/`
- **Feature gating** — `lib/tiers.ts` is the single source of truth. Use `canAccess(tier, feature)` to gate
- **Services** — all DB logic lives in `lib/services/*.service.ts` — never write raw queries in routes
- **Double-entry GL** — every financial transaction posts a balanced journal entry via `postJournalEntry()` in `general_ledger.service.ts`. GL posting is **BLOCKING and ATOMIC** — `createInvoice`, `createBill`, `createCreditNote`, `createExpense`, `approveExpense`, `convertToInvoice`, `approvePurchaseOrder`, `importOpeningBalances`, and `createIntercompanyTransaction` all use `withTransaction()` so a GL failure rolls back the parent record too. Never use try/catch to make GL non-blocking.
- **Email** — Resend via `lib/email.ts`. All `from:` addresses use `invoices@relentify.com` (production domain — do not change back to resend.dev).
- **Auth** — `getAuthUser()` from `src/lib/auth.ts` returns JWT payload (userId, actorId, email, subscriptionPlan?, isAccountantAccess?). Checks `relentify_client_token` first (accountant impersonation), falls through to `relentify_token`. Does NOT include entity_id or tier — call `getActiveEntity(auth.userId)` and `getUserById(auth.userId)` separately in routes.
- **Accountant access** — When `auth.isAccountantAccess === true`, `auth.userId` = client, `auth.actorId` = accountant. `checkPermission()` grants full access. `logAudit()` accepts optional 6th param `actorId` to record who made the change.
- **Import paths** — ALWAYS use `@/src/lib/` (not `@/lib/`). The tsconfig maps `@/` → app root, so `@/lib/` resolves to a non-existent directory.
- **Audit** — `logAudit()` from `src/lib/audit.service.ts` — signature: `logAudit(userId, action, entityType, entityId?, metadata?, actorId?, workspaceEntityId?)`. The `actor_id` and `workspace_entity_id` columns now exist in `audit_log` (migration 025). Previously, every `logAudit` call was silently failing because `actor_id` was missing from the DB.

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

✅ = Done | 🔴 = Not done

**Build order — say "do priority N" to start a group:**

| Group | Status | Scope |
|-------|--------|-------|
| Priority 1 | ✅ | Bugs |
| Priority 2 | ✅ | Foundational (suppliers, nav cleanup) |
| Priority 3 | ✅ | Core features + financial integrity + approval workflows |
| **Priority 4** | ✅ | **File attachments** |
| **Priority 5** | ✅ | **UI polish (batch all pages at once)** — all items complete |
| **Priority 6** | ✅ | **Production hardening** |
| **Priority 7** | 🔴 | **Advanced / post-launch** |

---

### ✅ Priority 1 — Bugs (complete)

| # | St | Item |
|---|----|------|
| 5 | ✅ | **Price formatting bug** — 1 qty × 10000 = £100.00. Declared fixed by user; verify in live testing. |
| 9 | ✅ | **Team invite link** — page at `/dashboard/team/accept` + email URL both correct. |
| 8 | ✅ | **Quotes email not delivered** — `from:` changed from resend.dev sandbox to `invoices@relentify.com`. |
| 19 | ✅ | **Connect bank bad request** — TrueLayer scope fixed to `info accounts balance offline_access`. |

---

### ✅ Priority 2 — Foundational (complete)

| # | St | Item |
|---|----|------|
| 11 | ✅ | **Suppliers page** — `/dashboard/suppliers`, full CRUD, `SupplierCombobox` in `@relentify/ui`. |
| 18 | ✅ | **Remove dead nav links** — Pay Bills / E-Banking removed. |

---

### ✅ Priority 3 — Core features + financial integrity + workflows (complete)

| # | St | Item |
|---|----|------|
| 10 | ✅ | Credit notes — list/create/detail/void with GL reversal. |
| 13 | ✅ | Bill invoice date field. |
| 14 | ✅ | Bill Record Payment modal — date, bank account, reference. GL + bank_transactions. |
| 41 | ✅ | Invoice Record Payment modal. GL: Dr Bank / Cr Debtors. |
| 16 | ✅ | PO supplier selection via SupplierCombobox. |
| 20 | ✅ | P&L frontend rebuild — GL-driven, CSV export. |
| 24 | ✅ | Balance sheet — date picker, shortcuts, assets/liabilities/equity, CSV. |
| 25 | ✅ | VAT returns — full HMRC MTD flow. |
| 26 | ✅ | Aged receivables + payables — 5 buckets, CSV. |
| 40 | ✅ | Journal entry workflow — COA picker, Dr/Cr grid, templates, reverse. |
| 29 | ✅ | Lock periods — `locked_through_date`, overrides, Settings UI. |
| 30 | ✅ | Block posting into locked periods — 403 `PERIOD_LOCKED` on all write routes. |
| 35 | ✅ | Opening balances / year-end rollover. |
| 45 | ✅ | Sentry error monitoring. |
| 15 | ✅ | **Expense/mileage approval flow** — `expense_approval_settings` per entity, approve/reject routes + emails, pending approvals panel, GL deferred to approval. Migration 019. |
| 31 | ✅ | **PO approval mapping** — `po_approver_mappings` (staff→approver override), fallback to entity setting, 24h escalation cron. Migration 019. |

---

### ✅ Priority 4 — File Attachments (complete)

Receipt/invoice PDF/photo upload against any bill, bank payment, or expense. Migration 020 applied.

**Storage:** `StorageProvider` abstraction — `STORAGE_BACKEND=postgres` (default, bytea) or `r2` (Cloudflare R2).
**Compression:** `sharp` for images (→ WEBP @ q80, max 2000px), Ghostscript for PDFs (`/ebook` 150 DPI). Always stores the smaller of compressed vs original.
**Tier gate:** `small_business` and above (`canAccess(tier, 'capture_bills_receipts')`).

**New files:**
- `database/migrations/020_attachments.sql` — `attachments` + `attachment_data` tables
- `src/lib/storage/index.ts` — StorageProvider interface + factory
- `src/lib/storage/postgres.ts` — bytea storage backend
- `src/lib/storage/r2.ts` — Cloudflare R2 backend (lazy-loaded, optional dep)
- `src/lib/compress-attachment.ts` — image (sharp) + PDF (ghostscript) compression
- `src/lib/attachment.service.ts` — CRUD service
- `app/api/attachments/route.ts` — GET list, POST upload (20MB cap, PDF/JPEG/PNG/WEBP)
- `app/api/attachments/[id]/route.ts` — GET file bytes, DELETE
- `src/components/Attachments.tsx` — shared client component

**Integrated into:** bills detail page, expenses page (per-expense + per-mileage), banking page (per-transaction).

**Env vars:** `STORAGE_BACKEND=postgres` (set in `.env`). For R2: add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` and change backend to `r2`.

**Dockerfile:** `apk add --no-cache ghostscript` in runner stage.
**next.config.js:** `serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner']`.

---

### ✅ Priority 5 — UI Polish (complete)

Several pages haven't been updated to match the dark-mode `@relentify/ui` style. Do all at once to avoid rework.

| # | Item |
|---|------|
| 1 | ✅ **Dashboard rebuild** — net position hero, profit YTD vs prior year, 30-day forecast, alerts strip. Bank balance line chart (daily, 6 months), cashflow bar chart (11 months + MTD + 30-day forecast bar), forecast drill-down modal. |
| 2 | ✅ **New invoice page** — removed redundant nav; all text-white → theme vars; border-white → theme-border. |
| 3 | ✅ **New invoice — inline project creation** — `+New` button opens modal; tier-gated via `canAccess(tier, 'project_tracking')`; auto-selects new project on create. |
| 4 | ✅ **Date pickers** — `DatePicker` component created in `@relentify/ui`; replaced all 25 native `<input type="date">` across 18 files. Uses Popover+Calendar; ISO string bridge appends `T00:00:00` to avoid UTC off-by-one. |
| 6 | ✅ **New quote page** — same fixes as invoice page; removed redundant nav, dark mode consistent. |
| 7 | ✅ **Team invite page** — text-white → theme vars; border-white → theme-border; card bg uses theme vars. |

---

### ✅ Priority 6 — Production Hardening

| # | Item |
|---|------|
| 46 | ✅ **API rate limiting** — in-process IP throttle in `middleware.ts`. 60 req/min general, 5/min for invoice send, 10/min for attachments. 66-minute ban on breach. Matcher expanded to `/api/:path*`. OAuth callbacks and cron routes added to PUBLIC_PATHS. |
| 42 | ✅ **GL silent failure visibility** — `Sentry.captureException()` added to all GL catch blocks across `invoice.service.ts`, `bill.service.ts`, `credit_note.service.ts`, `expense.service.ts`, `expense_approval.service.ts`. Each tagged with `gl_operation`. |
| 48 | ✅ **Company settings completeness** — migration 021 adds `registered_address`, `bank_account_name`, `sort_code`, `account_number` to `users` table. `/api/user/route.ts` and `/api/user/update/route.ts` updated. SettingsForm shows Registered Address + Bank Details for Remittances sections. |

---

### 🔴 Priority 7 — Advanced / Post-Launch

| # | Item |
|---|------|
| 28 | ✅ **Accountant signup + multi-client** — free accountant tier, `accountant_clients` table, both-direction invite (email + accept link), client portal at `/dashboard/accountant`, AccountantBanner when inside client account, 10% referral commission via `accountant_referral_earnings` (36 months, `invoice.payment_succeeded` webhook), bank details for manual payouts. Migration 022. |
| 38 | **Global accountant dashboard** — already covered by #28 (health stats: overdue invoices, unmatched transactions, missing receipts shown per client in portal). |
| 36 | ✅ **Comments/threads on transactions** — `transaction_comments` table (migration 023), `comment.service.ts`, API routes at `/api/comments`, shared `<Comments>` component. Wired into bills, invoices, expenses, banking, journals. Central `/dashboard/conversations` page. Email notification on first unread (unread-based, no delays). Unlimited thread nesting via `parent_id`. |
| 37 | ✅ **Bookkeeping health score** — 4 checks (reconciliation, missing receipts, overdue invoices, VAT compliance), scored out of 100. `/dashboard/reports/health`, API at `/api/reports/health`. |
| 39 | ✅ **Flexible custom reports** — custom date ranges, drill-downs, column picker, export. `/dashboard/reports/custom`, API at `/api/reports/custom`. |

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
| 15 | Expense/mileage approval flow — `expense_approval_settings` per entity. Approve/reject API routes + emails. Pending approvals panel + reject modal on expenses page. GL deferred to approval. Migration 019. |
| 31 | PO approval mapping — `po_approver_mappings` per entity (staff→approver override). Per-staff approver lookup with entity-wide fallback. 24h escalation cron. Settings UI: PO tab extended with mapping table. Migration 019. |

---

## Summary: ✅ Priority 1–6 complete | ✅ Priority 7 complete (#28 ✅, #36 ✅, #37 ✅, #39 ✅)

**Next:** say "do priority 4" (file attachments), "do priority 5" (UI polish), "do priority 6" (production hardening), or "do priority 7" (advanced features).

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

### ❌ Future roadmap
- **v0.7** CIS (Construction Industry Scheme)
- **v0.8** Domestic bill payments / E-Banking
- **v0.9** International payments
- **Payroll** — separate tool, not this app

---

## GL / Chart of Accounts

**Migrations applied:** 013 (chart_of_accounts), 014 (journal_entries + journal_lines), 015 (coa_account_id on bills/expenses/mileage_claims), 016 (credit_notes + credit_note_items), 017 (period_locks: `locked_through_date` on entities, `period_lock_history`, `period_lock_overrides`), 018 (`last_fy_end_date` on entities), 019 (approval workflows: `po_approver_mappings`, `expense_approval_settings`, approval columns on `expenses`/`mileage_claims`, `escalated_at` on `purchase_orders`), 020 (`attachments` metadata table + `attachment_data` bytea table), 021 (company details: `registered_address`, `bank_account_name`, `sort_code`, `account_number` on `users`), 022 (accountant multi-client: `accountant_clients`, `accountant_referral_earnings`), 023 (comments/threads: `transaction_comments`), 024 (HMRC client info), **025 (accounting engine: `idempotency_keys`, `cron_runs` tables; UNIQUE constraint on `journal_entries(entity_id, source_type, source_id)`; `status`/`is_accrual`/`reversal_date`/`reversed_by` on `journal_entries`; `is_prepayment`/`prepayment_months`/`prepayment_exp_acct` on `bank_transactions`; `is_control_account`/`control_type` on `chart_of_accounts`; `actor_id`/`workspace_entity_id` on `audit_log`; `role` on `workspace_members`; 4 performance indexes)**

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
| `src/lib/db.ts` | Postgres query wrapper. Exports: `query`, `pool` (default), `DbClient` type (`Pool \| PoolClient`), `withTransaction<T>(fn)` helper (BEGIN/COMMIT/ROLLBACK, pool max=20). |
| `lib/services/period_lock.service.ts` | `isDateLocked(entityId, date, userId)`, `lockPeriod()`, `unlockPeriod()`, override grant/revoke |
| `lib/hooks/usePeriodLock.ts` | Client hook — fetches earliest open date, provides `isDateLocked()` + `lockedMessage()` for form date inputs |
| `lib/period-lock-helpers.ts` | `parsePeriodLockedResponse(res)` — parses 403 PERIOD_LOCKED from any fetch response |
| `components/PeriodLockedModal.tsx` | Modal shown when a write is blocked by period lock; shows locked-through date + earliest open date |
| `src/lib/po_approver_mapping.service.ts` | `getApproverForStaff(entityId, staffUserId)` (per-staff override → entity fallback → null), `setPOApproverMapping`, `deletePOApproverMapping`, `getPOApproverMappings` |
| `src/lib/expense_approval.service.ts` | `getExpenseApprovalSettings`, `upsertExpenseApprovalSettings`, `approveExpense` (posts GL), `rejectExpense`, `approveMileage`, `rejectMileage`, `getPendingApprovals` |
| `src/lib/storage/index.ts` | `StorageProvider` interface + `getStorageProvider()` factory. Backend: `STORAGE_BACKEND=postgres\|r2`. |
| `src/lib/attachment.service.ts` | `getAttachments`, `createAttachment` (compresses + stores), `deleteAttachment`, `getAttachmentFile` |
| `src/lib/compress-attachment.ts` | `compressAttachment(buffer, mimeType)` — sharp for images, Ghostscript for PDFs, returns smaller result |
| `src/components/Attachments.tsx` | Client component — upload/list/delete attachments, props: `{ recordType, recordId }` |

---

## Database Notes

- All user data is scoped by `user_id` — always filter by it
- `entity_id` scopes data within a workspace (multi-entity support)
- Key tables: `users`, `entities`, `invoices`, `invoice_items`, `bills`, `expenses`, `mileage_claims`, `customers`, `suppliers`, `credit_notes`, `credit_note_items`, `bank_connections`, `bank_transactions`, `audit_logs`, `projects`, `intercompany_transactions`, `purchase_orders`, `po_items`, `po_settings`, `po_approver_mappings`, `expense_approval_settings`, `chart_of_accounts`, `journal_entries`, `journal_lines`, `attachments`, `attachment_data`
- `chart_of_accounts` — scoped by `entity_id`. System accounts (`is_system=TRUE`) cannot be deactivated.
- `journal_entries` + `journal_lines` — every financial event posts here. `source_type` + `source_id` link back to the originating record.
- `credit_notes` — linked to `invoices.id` (optional) and `customers.id` (optional). Sequence: `credit_note_number_seq`.

---

## Accounting Engine Workstream (2026-03-28, in progress)

Plan: `docs/superpowers/plans/2026-03-28-accounting-engine.md` (17 tasks)

### Task status

| # | Task | Status |
|---|------|--------|
| 1 | Migration 025 | ✅ Done |
| 2 | `db.ts` — withTransaction, DbClient, pool max=20 | ✅ Done |
| 3 | `idempotency.service.ts` — check/store/clean 24h keys | ✅ Done |
| 4 | GL service — PoolClient, period lock, control accounts, audit | ✅ Done |
| 5 | Audit service — workspaceEntityId param | 🔴 Pending |
| 6 | Invoice service — atomic createInvoice + recordPayment | 🔴 Pending |
| 7 | Bill service — atomic createBill + recordBillPayment | 🔴 Pending |
| 8 | Credit note, expense, approval services — atomic | ✅ Done |
| 9 | Quote, PO, opening balance, intercompany — atomic | ✅ Done |
| 10 | VAT engine service — explicit UK rules | ✅ Done |
| 11 | Cron monitoring — `cron_runs` table, Telegram alert | 🔴 Pending |
| 12 | Team roles — admin/accountant/staff, GL permission checks | 🔴 Pending |
| 13 | Accrual journals — draft mode, balance warning, auto-reversal cron | 🔴 Pending |
| 14 | Prepayment tracking — Dr Prepayments 1300, monthly release cron | 🔴 Pending |
| 15 | GL integrity diagnostic in health report | 🔴 Pending |
| 16 | Journal UI — Reverse button, Draft badge + Post action | 🔴 Pending |
| 17 | Build & deploy | 🔴 Pending |

### New services added by this workstream

| File | Purpose |
|------|---------|
| `src/lib/idempotency.service.ts` | `checkIdempotencyKey`, `storeIdempotencyKey`, `cleanExpiredKeys` — 24h TTL, entity-scoped |
| `src/lib/vat.service.ts` | Explicit UK VAT functions: `calcStandardRated`, `calcZeroRated`, `calcExempt`, `calcReverseCharge`, `calcPartialExemption`, `vatPeriodDate` |
| `src/lib/cron-monitor.service.ts` | `startCronRun(jobName)`, `finishCronRun(runId, status, count?, error?)` — logs to `cron_runs`, Telegram alert on failure |

### Key GL rules added

- `postJournalEntry` enforces period lock internally (cannot be bypassed)
- Invoice journal entries must have `isControlAR: true` on the Debtors line
- Bill journal entries must have `isControlAP: true` on the Creditors line
- All entries written with `status='posted'` and `is_locked=TRUE`
- `workspace_members.role` — `admin | accountant | staff` (default `staff`). Manual journals require `admin` or `accountant`.

---

## All Remaining Work — Master Summary

> To work on any item: read the plan file listed, then implement task by task using subagent-driven development. One task at a time.

| # | Workstream | Tasks remaining | Plan file | Status |
|---|------------|----------------|-----------|--------|
| 1 | **Accounting Engine** | 13 of 17 (tasks 5–17) | `docs/superpowers/plans/2026-03-28-accounting-engine.md` | 🔄 In progress |
| 2 | **UI Animations** | 11 of 11 | `docs/superpowers/plans/2026-03-28-ui-animations.md` | 🔴 Not started |
| 3 | **Help System** | 15 of 15 | `docs/superpowers/plans/2026-03-28-help-system.md` | 🔴 Not started |
| 4 | **Migration Tool** | 17 of 17 | `docs/superpowers/plans/2026-03-28-migration-tool.md` | 🔴 Not started |
| 5 | **Recording System** | 8 of 8 | `docs/superpowers/plans/2026-03-28-recording-system.md` | 🔴 Not started |
| 6 | **Developer API** | 15 of 15 | `docs/superpowers/plans/2026-03-28-developer-api.md` | 🔴 Not started |

### Accounting Engine — remaining tasks (next up: Task 5)

| # | Task | Status |
|---|------|--------|
| 5 | Audit service — add `workspaceEntityId` 7th param | ✅ Done |
| 6 | Invoice service — atomic `createInvoice` + `recordPayment` + `voidInvoice` | ✅ Done |
| 7 | Bill service — atomic `createBill` + `recordBillPayment` | ✅ Done |
| 8 | Credit note, expense, approval services — atomic | ✅ Done |
| 9 | Quote, PO, opening balance, intercompany — atomic | ✅ Done |
| 10 | VAT engine service — explicit UK rules | ✅ Done |
| 11 | Cron monitoring — `cron_runs` table, Telegram alert on failure | ✅ Done |
| 12 | Team roles — `getMemberRole`, `requireGLRole` permission checks | 🔴 |
| 13 | Accrual journals — draft mode, balance warning, auto-reversal cron | 🔴 |
| 14 | Prepayment tracking — Dr Prepayments 1300, monthly release cron | 🔴 |
| 15 | GL integrity diagnostic in health report | 🔴 |
| 16 | Journal UI — Reverse button, Draft badge + Post action | 🔴 |
| 17 | Build & deploy | 🔴 |

---

## All Feature Plans & Specs

**Specs** (design docs): `docs/superpowers/specs/`
**Plans** (implementation plans): `docs/superpowers/plans/`

| Workstream | Spec | Plan | Status |
|------------|------|------|--------|
| Accounting Engine | `2026-03-26-accounting-engine-design.md` | `2026-03-28-accounting-engine.md` | 🔄 In progress (tasks 1–4 done) |
| UI Animations (Framer Motion) | — | `2026-03-28-ui-animations.md` | 🔴 Not started |
| Help System (apps/26help) | — | `2026-03-28-help-system.md` | 🔴 Not started |
| Migration Tool (Xero/QB import) | `2026-03-26-migration-tool-design.md` | `2026-03-28-migration-tool.md` | 🔴 Not started |
| Recording System (screen capture) | `2026-03-26-recording-system-design.md` | `2026-03-28-recording-system.md` | 🔴 Not started |
| Developer API + Webhooks | `2026-03-26-developer-api-design.md` | `2026-03-28-developer-api.md` | 🔴 Not started |

---

## Developer API + Webhooks Workstream

**Plan:** `docs/superpowers/plans/2026-03-28-developer-api.md` — **15 tasks, all remaining**
**Spec:** `docs/superpowers/specs/2026-03-26-developer-api-design.md`
**To implement:** Read the plan file and work through tasks 1–15 using subagent-driven development.

Opens 22accounting to external callers via an authenticated REST API and webhook delivery system.

### What it builds

- **API key auth layer:** Bearer token → SHA-256 hash → `api_keys` table lookup. No JWT/cookie required for external callers. Key format: `rly_` + 64 hex chars (32 random bytes). First 8 chars stored as `key_prefix` for display.
- **Versioned public API:** `/api/v1/` route surface wraps existing service logic. Routes rewrite `/api/v1/*` → `/api/*` internally; handlers read `x-api-entity-id`, `x-api-user-id`, `x-api-scopes` headers set by middleware.
- **Scoped access:** Each key has a scopes array (e.g. `invoices:read`, `invoices:write`). IP allowlist optional per key.
- **Sandbox/test mode:** Keys with `is_test_mode=TRUE` run full validation but skip GL/DB writes; response includes `"test": true`.
- **Tier-based rate limiting:** In-memory sliding window per API key, limits vary by subscription tier.
- **Webhook delivery:** `dispatchWebhookEvent(entityId, 'invoice.paid', payload)` inserts `webhook_deliveries` rows and fires async delivery. Cron at `/api/cron/webhooks` retries with exponential backoff. Dead-lettered after 5 failures; endpoint deactivated + email alert sent.
- **Settings UI:** API Keys panel (list/create/revoke/rotate) + Webhooks panel (endpoints + event subscriptions) added to `/dashboard/settings`.

### New DB tables (migration 026_developer_api.sql)

| Table | Purpose |
|-------|---------|
| `api_keys` | `key_hash` (SHA-256), `key_prefix`, `entity_id`, `user_id`, `scopes[]`, `ip_allowlist[]`, `is_test_mode`, `revoked_at`, `rotated_key_id` |
| `webhook_endpoints` | `url`, `entity_id`, `events[]`, `signing_secret`, `is_active` |
| `webhook_deliveries` | `endpoint_id`, `event`, `payload`, `status`, `retry_count`, `next_retry_at`, `dead_lettered_at` |
| `api_requests` | Async-logged per-request audit: `key_id`, `path`, `method`, `status_code`, `duration_ms` |

### New files

| File | Purpose |
|------|---------|
| `src/lib/api-key.service.ts` | `createApiKey`, `validateApiKey`, `revokeKey`, `rotateKey` |
| `src/lib/webhook.service.ts` | `dispatchWebhookEvent`, `processDelivery`, `signPayload` (HMAC-SHA256) |
| `app/api/v1/invoices/route.ts` | Public GET invoices, POST create invoice |
| `app/api/v1/bills/route.ts` | Public GET bills, POST create bill |
| `app/api/v1/customers/route.ts` | Public CRUD customers |
| `app/api/cron/webhooks/route.ts` | Webhook retry cron (every minute) |

### Key technical decisions

- SHA-256 hash storage: raw token never stored, only the hash — same pattern as HMRC tokens
- Webhook HMAC: `Relentify-Signature: sha256=<hex>` header, signed with per-endpoint secret
- Delivery headers: `Relentify-Delivery-Id`, `Relentify-Retry-Count`, `Relentify-Event`
- Dead-letter: after 5 failures status=`dead_lettered`, endpoint `is_active=FALSE`, email to owner
- Rate limits do NOT use the same in-process IP throttle as `middleware.ts` — separate per-key counter

---

## Migration Tool Workstream

**Plan:** `docs/superpowers/plans/2026-03-28-migration-tool.md` — **17 tasks, all remaining**
**Spec:** `docs/superpowers/specs/2026-03-26-migration-tool-design.md`
**To implement:** Read the plan file and work through tasks 1–17 using subagent-driven development.

Allows businesses migrating from Xero or QuickBooks to import financial history via a 6-step wizard.

### What it builds

- **6-step wizard** at `/dashboard/migrate`: Source select → File upload → Account mapping → Trial balance review → Confirm → Progress
- **Client-side parsing:** Papa Parse in-browser. Files >5MB offloaded to a Web Worker (`src/lib/migration/worker.ts`). Files >20MB offered server-side parse via R2 presigned URL.
- **Normalised interface:** `MigrationSource` interface — both `XeroParser` and `QuickBooksParser` return the same `MigrationData` shape.
- **Levenshtein fuzzy account matching** with 3 confidence tiers: HIGH (auto-accepted), MEDIUM (review suggested), LOW (manual required). Matching logic in `src/lib/migration/matcher.ts`.
- **`skipGLPosting` flag** added to `createInvoice` and `createBill`: historical transactions import without creating duplicate GL entries. Trial balance figures imported via `importOpeningBalances()` as the single GL truth at cutoff date.
- **Transactional import:** All DB writes wrapped in `withTransaction()`. Partial success supported via batch state in `migration_runs.batches` (completed batches skipped on resume).
- **Tier gate:** `small_business` and above. New feature key `platform_migration` added to `tiers.ts`.

### New DB tables (migration 026_migration_runs.sql)

| Table | Purpose |
|-------|---------|
| `migration_runs` | `entity_id`, `user_id`, `source` (xero/quickbooks), `cutoff_date`, `files_uploaded` (JSONB), `auto_mappings` (JSONB), `validation_warnings` (JSONB), `status`, `batches` (JSONB progress per batch), `completed_at` |

### New files

| File | Purpose |
|------|---------|
| `src/lib/migration/types.ts` | `MigrationSource` interface, `MigrationData`, confidence enum |
| `src/lib/migration/xero.parser.ts` | Xero CSV parser |
| `src/lib/migration/quickbooks.parser.ts` | QuickBooks IIF/CSV parser |
| `src/lib/migration/matcher.ts` | Levenshtein fuzzy account matcher |
| `src/lib/migration/validation.ts` | Trial balance checker |
| `src/lib/migration/import.service.ts` | `MigrationData` → Relentify records |
| `src/lib/migration/worker.ts` | Web Worker entry point for large files |
| `app/api/migration/import/route.ts` | SSE streaming progress endpoint |
| `app/dashboard/migrate/page.tsx` | 6-step wizard |

### Key technical decisions

- `skipGLPosting: true` is the critical flag — without it, importing 3 years of invoices would create 3 years of duplicate GL entries on top of the imported opening balance
- SSE (Server-Sent Events) for real-time import progress — not WebSocket
- Migration 026 may conflict with recording system's 026 migration — one of these must be renumbered to 027 when both are implemented

---

## UI Animations Workstream (Framer Motion)

**Plan:** `docs/superpowers/plans/2026-03-28-ui-animations.md` — **11 tasks, all remaining**
**To implement:** Read the plan file and work through tasks 1–11 using subagent-driven development.

Replaces all CSS-only transitions in `@relentify/ui` with a physically-natural Framer Motion spring system.

### What it builds

- **`packages/ui/src/animations.ts`** — single source of truth for all spring presets and motion variants. Components must import from here; no hardcoded animation values anywhere.
- **Spring presets** (4 named presets):
  - `spring.snappy` — buttons, toggles, dropdowns (stiffness 500, damping 34, mass 0.7)
  - `spring.smooth` — modals, sheets, panels (stiffness 360, damping 32, mass 1.0)
  - `spring.gentle` — page transitions, overlays (stiffness 260, damping 28, mass 1.1)
  - `spring.bounce` — success states, checkbox tick (stiffness 420, damping 22, mass 0.8)
- **`motion()` wrapping Radix primitives:** Dialog, AlertDialog, Sheet, DropdownMenu, Popover — spring entrance, instant CSS exit (no remount flash).
- **Full Framer Motion** on: Button (whileTap y:1 press depth, opacity layering), Toast (AnimatePresence + slideUp), Switch (spring thumb x), Checkbox (bounce scale on tick), Card/StatsCard (whileHover y:-2 lift), ThemeToggleButton (icon rotation).
- **`MotionProvider`** wrapper — required in dashboard layout to enable AnimatePresence for page transitions.
- **Page transitions** added to `apps/22accounting/app/dashboard/layout.tsx`.

### Scope: `packages/ui` only

All changes are in `packages/ui` (and 22accounting layout). No other app needs changes — the animation system is inherited by all apps that use `@relentify/ui`.

### Key technical decisions

- Press depth: `y: 1` on whileTap (physical push feel) — not just scale
- Radix overlays use CSS `display:none` on exit; we cannot use AnimatePresence for exit animation on Radix-controlled components. Solution: instant CSS exit, spring entrance only.
- `layoutId` on TabsNav active indicator enables spring-animated indicator sliding between tabs without remount.
- `MotionProvider` must be a `"use client"` component at layout level — required for AnimatePresence to work across RSC boundaries.

---

## Help System Workstream

**Plan:** `docs/superpowers/plans/2026-03-28-help-system.md` — **15 tasks, all remaining**
**To implement:** Read the plan file and work through tasks 1–15 using subagent-driven development.

New standalone help site at `help.relentify.com` with contextual in-app help integrated into 22accounting.

### What it builds

- **New monorepo app `apps/26help`** — Next.js 15 with `output: 'export'` (fully static). Deployed as Docker container on port 3026.
- **MDX content source:** 20 help articles in `apps/26help/content/accounting/*.mdx`. Each article has Zod-validated frontmatter (`title`, `description`, `appRoute`, `category`, `order`).
- **Pagefind search:** `npx pagefind --site out` runs post-build to index the static export. Search UI at top of help home page via `HelpSearch.tsx`.
- **Playwright video guides:** Recording scripts in `apps/26help/playwright/scripts/*.ts` capture Playwright automation of 22accounting UI, compressed via ffmpeg. `VideoGuide.tsx` lazy-loads them.
- **In-app integration in 22accounting:**
  - `HelpButton` — `?` icon in top nav, links to help article for current page (resolved via `helpUrlMap`)
  - `HelpTooltip` — `ⓘ` inline tooltip on form fields, text sourced from `apps/26help/content/fields.ts`
  - `helpUrlMap` — auto-generated from MDX `appRoute` frontmatter; maps `/dashboard/invoices` → `help.relentify.com/accounting/create-invoice`

### New files

| File | Purpose |
|------|---------|
| `apps/26help/` | Entire new app (package.json, tsconfig, next.config.js, Dockerfile, docker-compose.yml) |
| `apps/26help/src/lib/content.ts` | Zod schema + MDX loader |
| `apps/26help/content/accounting/*.mdx` | 20 help articles |
| `apps/26help/content/fields.ts` | Field key → tooltip text |
| `apps/22accounting/app/components/HelpButton.tsx` | `?` nav button |
| `apps/22accounting/app/components/HelpTooltip.tsx` | Inline field tooltip |
| `apps/22accounting/app/lib/help-urls.ts` | `helpUrlMap` (auto-generated from MDX frontmatter) |

### Key technical decisions

- Static export (`output: 'export'`) means no server-side rendering. Pagefind runs on the built `out/` directory. The help site is pure HTML/CSS/JS served by `serve` in Docker.
- `helpUrlMap` is generated at build time from MDX frontmatter — no manual maintenance of URL-to-article mapping
- Field tooltip text lives in `fields.ts` in `apps/26help/content/` (single source for both help site context and 22accounting tooltips)
- Caddy block needed: `help.relentify.com → 26help:3026`
- Container: `26help` on port 3026, `infra_default` network

---

## Recording System Workstream

**Plan:** `docs/superpowers/plans/2026-03-28-recording-system.md` — **8 tasks, all remaining**
**Spec:** `docs/superpowers/specs/2026-03-26-recording-system-design.md`
**To implement:** Read the plan file and work through tasks 1–8 using subagent-driven development.

A "Report Issue" screen recording system built into the 22accounting dashboard.

### What it builds

- **`RecordingManager` interface** — platform-agnostic API for start/stop/discard. `WebRecordingManager` implements it using `getDisplayMedia()` + `MediaRecorder`. Future: `NativeRecordingManager` for React Native.
- **`RecordingContext`** — React context in `app/dashboard/layout.tsx` that holds state machine: idle → recording → reviewing → uploading.
- **4 UI components:** `RecordingButton` (camera icon in top nav, browser support check, audio toggle), `RecordingIndicator` (fixed floating pill with live timer + stop button), `RecordingPanel` (slide-up panel with description field, progress bar, Discard/Send), `RecordingContext.tsx`.
- **Chunked upload:** 5MB chunks, each POSTed to `/api/recordings/upload`. Progress percentage exposed via context for the progress bar.
- **Storage:** Uses existing `getStorageProvider()` factory — R2 or Postgres bytea, same as attachments.
- **Audit log:** `recording_uploads` table via `recording.service.ts` — mirrors `attachment.service.ts` pattern.
- **Support email:** Resend email to `SUPPORT_EMAIL` env var with recording link + description, via existing `src/lib/email.ts` pattern.
- **PostHog analytics:** events `recording_started`, `recording_sent`, `recording_discarded` — via existing `Analytics.tsx` pattern.
- **beforeunload warning:** Prevents accidental tab close during active recording.

### New DB tables (migration 026_recording_uploads.sql)

| Table | Purpose |
|-------|---------|
| `recording_uploads` | `id`, `user_id`, `entity_id`, `filename`, `size_bytes`, `mime_type`, `storage_key`, `description`, `created_at` |

### New files

| File | Purpose |
|------|---------|
| `src/lib/recording/types.ts` | `RecordingManager` interface + shared types |
| `src/lib/recording/web.ts` | `WebRecordingManager` (getDisplayMedia + MediaRecorder) |
| `src/lib/recording/index.ts` | `getRecordingManager()` factory |
| `src/lib/recording.service.ts` | `logRecordingUpload`, `uploadRecordingToStorage`, `sendSupportEmail` |
| `app/api/recordings/upload/route.ts` | Chunked upload handler |
| `app/components/recording/RecordingContext.tsx` | State machine + provider |
| `app/components/recording/RecordingButton.tsx` | Nav button |
| `app/components/recording/RecordingIndicator.tsx` | Floating pill timer |
| `app/components/recording/RecordingPanel.tsx` | Send/discard panel |

### Key technical decisions

- Chunked upload: 5MB per chunk, not streaming — simpler retry logic
- `RecordingManager` interface designed for future React Native parity — don't call `getDisplayMedia` directly anywhere except `WebRecordingManager`
- New env var: `SUPPORT_EMAIL` — add to `.env.example`
- Migration 026 note: both migration tool and recording system use 026 — one must be renumbered to 027 when both are implemented in sequence

---

## Rebuild & Deploy

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50
docker builder prune -f   # always run after build — cache grows to 2-3GB
```
