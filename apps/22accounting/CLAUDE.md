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
- **Double-entry GL** — every financial transaction posts a balanced journal entry via `postJournalEntry()` in `general_ledger.service.ts`. GL posting is non-blocking (try/catch) — the transaction still saves if GL fails. Do not bypass this.
- **Email** — Resend via `lib/email.ts`. All `from:` addresses use `invoices@relentify.com` (production domain — do not change back to resend.dev).
- **Auth** — `getAuthUser()` from `src/lib/auth.ts` returns JWT payload (userId, actorId, email, subscriptionPlan?, isAccountantAccess?). Checks `relentify_client_token` first (accountant impersonation), falls through to `relentify_token`. Does NOT include entity_id or tier — call `getActiveEntity(auth.userId)` and `getUserById(auth.userId)` separately in routes.
- **Accountant access** — When `auth.isAccountantAccess === true`, `auth.userId` = client, `auth.actorId` = accountant. `checkPermission()` grants full access. `logAudit()` accepts optional 6th param `actorId` to record who made the change.
- **Import paths** — ALWAYS use `@/src/lib/` (not `@/lib/`). The tsconfig maps `@/` → app root, so `@/lib/` resolves to a non-existent directory.
- **Audit** — `logAudit()` from `src/lib/audit.service.ts` — signature: `logAudit(userId, action, entityType, entityId?, metadata?, actorId?)`

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

**Migrations applied:** 013 (chart_of_accounts), 014 (journal_entries + journal_lines), 015 (coa_account_id on bills/expenses/mileage_claims), 016 (credit_notes + credit_note_items), 017 (period_locks: `locked_through_date` on entities, `period_lock_history`, `period_lock_overrides`), 018 (`last_fy_end_date` on entities), 019 (approval workflows: `po_approver_mappings`, `expense_approval_settings`, approval columns on `expenses`/`mileage_claims`, `escalated_at` on `purchase_orders`), 020 (`attachments` metadata table + `attachment_data` bytea table)

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

## Rebuild & Deploy

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50
docker builder prune -f   # always run after build — cache grows to 2-3GB
```
