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

## Complete API Route Inventory

**Total: ~150 endpoints across 35+ route groups** (includes `/api/v1/`, `/api/mismatches/`, `/api/webhooks-ui/`)

### Authentication & User
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/logout` | Yes | Logout, clear cookie |
| GET | `/api/auth/me` | Yes | Current user info |
| GET | `/api/health` | No | Health check |
| GET | `/api/user` | Yes | Get user profile + company settings |
| PATCH | `/api/user/update` | Yes | Update user profile |
| POST | `/api/user/change-password` | Yes | Change password |
| DELETE | `/api/account/delete` | Yes | Delete account |
| GET | `/api/account/export` | Yes | Export account data |

### Customers & Suppliers
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/customers` | Yes | List / create customer |
| GET/PATCH/DELETE | `/api/customers/[id]` | Yes | Get / update / delete customer |
| GET/POST | `/api/suppliers` | Yes | List / create supplier |
| GET/PATCH/DELETE | `/api/suppliers/[id]` | Yes | Get / update / delete supplier |

### Invoices
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/invoices` | Yes | List / create invoice |
| GET/PATCH/DELETE | `/api/invoices/[id]` | Yes | Get / update / delete invoice |
| POST | `/api/invoices/[id]/pay` | Yes | Record payment |
| POST | `/api/invoices/[id]/send` | Yes | Send invoice email |
| GET | `/api/invoices/stats` | Yes | Invoice statistics |

### Quotes
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/quotes` | Yes | List / create quote |
| GET/PATCH/DELETE | `/api/quotes/[id]` | Yes | Get / update / delete quote |
| POST | `/api/quotes/[id]/convert` | Yes | Convert to invoice |
| POST | `/api/quotes/[id]/send` | Yes | Send quote email |

### Bills
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/bills` | Yes | List / create bill |
| GET/PATCH/DELETE | `/api/bills/[id]` | Yes | Get / update / delete bill |
| POST | `/api/bills/[id]/pay` | Yes | Record bill payment |
| GET | `/api/bills/bank-accounts` | Yes | List bank accounts for bill payment |

### Credit Notes
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/credit-notes` | Yes | List / create credit note |
| GET/PATCH | `/api/credit-notes/[id]` | Yes | Get / void credit note |

### Expenses & Mileage
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/expenses` | Yes | List / create expense |
| GET/PATCH/DELETE | `/api/expenses/[id]` | Yes | Get / update / delete expense |
| POST | `/api/expenses/[id]/approve` | Yes | Approve expense |
| POST | `/api/expenses/[id]/reject` | Yes | Reject expense |
| GET | `/api/expenses/pending-approvals` | Yes | List pending approvals |
| GET/PATCH | `/api/expense-approval-settings` | Yes | Get / update approval settings |
| GET/POST | `/api/mileage` | Yes | List / create mileage claim |
| GET/DELETE | `/api/mileage/[id]` | Yes | Get / delete mileage claim |
| POST | `/api/mileage/[id]/approve` | Yes | Approve mileage |
| POST | `/api/mileage/[id]/reject` | Yes | Reject mileage |

### Purchase Orders
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/po` | Yes | List / create PO |
| GET/PATCH | `/api/po/[id]` | Yes | Get / update PO |
| POST | `/api/po/[id]/approve` | Yes | Approve PO |
| POST | `/api/po/[id]/reject` | Yes | Reject PO |
| GET/PATCH | `/api/po/settings` | Yes | PO settings (enable/disable) |
| GET | `/api/po/approve-link` | No | PO approval via email link |
| GET/POST | `/api/po/approver-mappings` | Yes | List / create approver mappings |
| DELETE | `/api/po/approver-mappings/[staffId]` | Yes | Delete approver mapping |

### Projects
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/projects` | Yes | List / create project |
| GET/PATCH/DELETE | `/api/projects/[id]` | Yes | Get / update / delete project |

### Chart of Accounts & Journals
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/accounts` | Yes | List COA / create account |
| GET/PATCH/DELETE | `/api/accounts/[id]` | Yes | Get / update / deactivate account |
| GET/POST | `/api/journals` | Yes | List / create journal entry |
| GET/PATCH/DELETE | `/api/journals/[id]` | Yes | Get / reverse / delete journal |
| GET | `/api/ledger` | Yes | General ledger report |

### Banking
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/banking` | Yes | List bank accounts + transactions |
| POST | `/api/banking/[id]/match` | Yes | Manually match transaction |

### OpenBanking (TrueLayer)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/openbanking/connect` | Yes | Initiate bank connection |
| POST | `/api/openbanking/disconnect` | Yes | Disconnect bank |
| GET | `/api/openbanking/callback` | No | OAuth callback |
| POST | `/api/openbanking/sync` | Yes | Sync transactions |

### Reports
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/reports/pl` | Yes | Profit & Loss |
| GET | `/api/reports/balance-sheet` | Yes | Balance Sheet |
| GET | `/api/reports/trial-balance` | Yes | Trial Balance |
| GET | `/api/reports/cashflow` | Yes | Cash Flow |
| GET | `/api/reports/aged-receivables` | Yes | Aged Receivables |
| GET | `/api/reports/aged-payables` | Yes | Aged Payables |
| GET | `/api/reports/kpi` | Yes | KPI Dashboard |
| GET | `/api/reports/health` | Yes | Health Score |
| GET | `/api/reports/custom` | Yes | Custom Report |
| GET | `/api/reports/consolidated` | Yes | Consolidated (multi-entity) |

### HMRC / VAT
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/hmrc/connect` | Yes | Connect to HMRC |
| POST | `/api/hmrc/disconnect` | Yes | Disconnect HMRC |
| GET | `/api/hmrc/callback` | No | OAuth callback |
| GET | `/api/hmrc/client-info` | Yes | HMRC client info |
| GET | `/api/hmrc/obligations` | Yes | VAT obligations |
| POST | `/api/hmrc/vat/calculate` | Yes | Calculate 9-box return |
| POST | `/api/hmrc/vat/submit` | Yes | Submit VAT return |

### Period Locks
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/period-locks` | Yes | Get / set lock date |
| GET | `/api/period-locks/earliest-open` | Yes | Earliest open date |
| GET/POST | `/api/period-locks/overrides` | Yes | List / grant overrides |
| DELETE | `/api/period-locks/overrides/[userId]` | Yes | Revoke override |

### Year-End
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/year-end/preview` | Yes | Preview year-end close |
| POST | `/api/year-end/close` | Yes | Execute year-end close |

### Stripe
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/stripe/checkout` | Yes | Create checkout session |
| POST | `/api/stripe/connect` | Yes | Connect Stripe account |
| POST | `/api/stripe/disconnect` | Yes | Disconnect Stripe |
| GET | `/api/stripe/callback` | No | OAuth callback |
| GET | `/api/stripe/status` | Yes | Connection status |
| POST | `/api/webhooks/stripe` | No | Stripe webhook handler |

### Entities (Multi-Entity)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/entities` | Yes | List / create entity |
| GET/PATCH/DELETE | `/api/entities/[id]` | Yes | Get / update / delete entity |
| POST | `/api/entities/[id]/activate` | Yes | Activate entity |

### Intercompany
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/intercompany` | Yes | Create intercompany transaction |

### Accountant
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/PATCH | `/api/accountant/bank-details` | Yes | Get / update bank details |
| GET | `/api/accountant/clients` | Yes | List clients |
| GET | `/api/accountant/clients/[id]` | Yes | Get client details |
| GET | `/api/accountant/earnings` | Yes | View referral earnings |
| POST | `/api/accountant/invite` | Yes | Send client invitation |
| POST | `/api/accountant/invite/accept` | No | Accept invitation |
| POST | `/api/accountant/switch` | Yes | Switch to client account |

### Team
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/team` | Yes | List / invite team member |
| PATCH/DELETE | `/api/team/[memberId]` | Yes | Update / remove member |
| POST | `/api/team/accept` | No | Accept team invitation |

### Workspace
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/workspace/list` | Yes | List workspaces |
| POST | `/api/workspace/switch` | Yes | Switch workspace |
| POST | `/api/workspace/leave` | Yes | Leave workspace |

### Comments & Attachments
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/comments` | Yes | List / create comment |
| DELETE | `/api/comments/[id]` | Yes | Delete comment |
| GET | `/api/comments/conversations` | Yes | List conversations |
| GET/POST | `/api/attachments` | Yes | List / upload attachment |
| GET/DELETE | `/api/attachments/[id]` | Yes | Download / delete attachment |

### Audit & Settings
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/audit` | Yes | Audit log |
| PATCH | `/api/settings/accountant` | Yes | Update accountant settings |

### Import & Migration
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/api/import` | Yes | Import data (CSV/XLSX) |
| GET | `/api/import/template` | Yes | Download import template |
| POST | `/api/import/opening-balances` | Yes | Import opening balances |
| GET | `/api/import/opening-balances/template` | Yes | Download OB template |
| POST | `/api/migration/import` | Yes | Migration import (SSE streaming) |
| POST | `/api/migration/server-parse` | Yes | Server-side file parse |

### Recordings
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/recordings` | Yes | List recordings |
| POST | `/api/recordings/upload` | Yes | Upload recording |
| GET | `/api/recordings/[id]/stream` | Yes | Stream recording |

### Cron Jobs (internal, protected by x-cron-secret)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/cron/reminders` | Cron | Send payment reminders |
| POST | `/api/cron/po-escalation` | Cron | Escalate overdue PO approvals |
| POST | `/api/cron/accrual-reversals` | Cron | Reverse accrual journals |
| POST | `/api/cron/prepayment-release` | Cron | Release prepayment portions |

---

## Complete UI Page Map

**Total: 55+ pages**

### Top-Level
| Path | Purpose |
|------|---------|
| `/` | Landing / redirect |
| `/payment/success` | Stripe payment success |
| `/payment/cancel` | Stripe payment cancel |
| `/po-reject` | PO rejection via email link |

### Dashboard
| Path | Purpose |
|------|---------|
| `/dashboard` | Main dashboard (net position, forecast, charts) |
| `/dashboard/invoices` | Invoice list |
| `/dashboard/invoices/new` | Create invoice |
| `/dashboard/invoices/[id]` | Invoice detail |
| `/dashboard/invoices/[id]/edit` | Edit invoice |
| `/dashboard/quotes` | Quote list |
| `/dashboard/quotes/new` | Create quote |
| `/dashboard/quotes/[id]` | Quote detail |
| `/dashboard/bills` | Bill list |
| `/dashboard/bills/new` | Create bill |
| `/dashboard/bills/[id]` | Bill detail |
| `/dashboard/credit-notes` | Credit note list |
| `/dashboard/credit-notes/new` | Create credit note |
| `/dashboard/credit-notes/[id]` | Credit note detail |
| `/dashboard/expenses` | Expenses + mileage list |
| `/dashboard/po` | Purchase order list |
| `/dashboard/po/new` | Create PO |
| `/dashboard/po/[id]` | PO detail |
| `/dashboard/customers` | Customer list |
| `/dashboard/customers/new` | Create customer |
| `/dashboard/customers/[id]` | Customer detail |
| `/dashboard/suppliers` | Supplier list |
| `/dashboard/suppliers/new` | Create supplier |
| `/dashboard/suppliers/[id]` | Supplier detail |
| `/dashboard/projects` | Project list |
| `/dashboard/projects/new` | Create project |
| `/dashboard/projects/[id]` | Project detail |
| `/dashboard/journals` | Journal entry list |
| `/dashboard/journals/new` | Create journal entry |
| `/dashboard/chart-of-accounts` | Chart of Accounts |
| `/dashboard/banking` | Bank accounts + transactions |
| `/dashboard/vat` | VAT returns + HMRC |
| `/dashboard/import` | Import data + opening balances |
| `/dashboard/migrate` | Migration wizard (Xero/QB) |

### Reports
| Path | Purpose |
|------|---------|
| `/dashboard/reports/pl` | Profit & Loss |
| `/dashboard/reports/balance-sheet` | Balance Sheet |
| `/dashboard/reports/trial-balance` | Trial Balance |
| `/dashboard/reports/general-ledger` | General Ledger |
| `/dashboard/reports/cashflow` | Cash Flow |
| `/dashboard/reports/aged` | Aged Receivables + Payables |
| `/dashboard/reports/kpi` | KPI Dashboard |
| `/dashboard/reports/health` | Health Score |
| `/dashboard/reports/custom` | Custom Report |
| `/dashboard/reports/consolidated` | Consolidated (multi-entity) |

### Admin & Settings
| Path | Purpose |
|------|---------|
| `/dashboard/settings` | Company settings (tabs: general, bank, period locks, PO) |
| `/dashboard/team` | Team management |
| `/dashboard/team/accept` | Accept team invitation |
| `/dashboard/entities` | Entity list (multi-entity) |
| `/dashboard/entities/new` | Create entity |
| `/dashboard/entities/[id]/edit` | Edit entity |
| `/dashboard/audit` | Audit log |
| `/dashboard/conversations` | Comments/threads |
| `/dashboard/receipts` | Receipt management |
| `/dashboard/recordings` | Screen recordings |
| `/dashboard/upgrade` | Upgrade plan |
| `/dashboard/accountant` | Accountant portal (client list) |
| `/dashboard/accountant/settings` | Accountant settings |

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
| **Priority 7** | ✅ | **Advanced / post-launch** |

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

### ✅ Priority 7 — Advanced / Post-Launch (complete)

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

## Summary: ✅ Priority 1–7 complete

All pre-launch priority groups are done. See **Remaining Work — Launch Blockers** below for what's still needed before public launch.

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
- **v0.7** Developer API + Webhooks (`/api/v1/`), API key management, webhook delivery system
- **v0.7** Help system (`apps/26help`), migration tool, recording system, UI animations

### ❌ Future roadmap
- **v0.8** CIS (Construction Industry Scheme)
- **v0.9** Domestic bill payments / E-Banking
- **v1.0** International payments
- **Payroll** — separate tool, not this app

---

## GL / Chart of Accounts

**Migrations applied:** 013 (chart_of_accounts), 014 (journal_entries + journal_lines), 015 (coa_account_id on bills/expenses/mileage_claims), 016 (credit_notes + credit_note_items), 017 (period_locks: `locked_through_date` on entities, `period_lock_history`, `period_lock_overrides`), 018 (`last_fy_end_date` on entities), 019 (approval workflows: `po_approver_mappings`, `expense_approval_settings`, approval columns on `expenses`/`mileage_claims`, `escalated_at` on `purchase_orders`), 020 (`attachments` metadata table + `attachment_data` bytea table), 021 (company details: `registered_address`, `bank_account_name`, `sort_code`, `account_number` on `users`), 022 (accountant multi-client: `accountant_clients`, `accountant_referral_earnings`), 023 (comments/threads: `transaction_comments`), 024 (HMRC client info), **025 (accounting engine: `idempotency_keys`, `cron_runs` tables; UNIQUE constraint on `journal_entries(entity_id, source_type, source_id)`; `status`/`is_accrual`/`reversal_date`/`reversed_by` on `journal_entries`; `is_prepayment`/`prepayment_months`/`prepayment_exp_acct` on `bank_transactions`; `is_control_account`/`control_type` on `chart_of_accounts`; `actor_id`/`workspace_entity_id` on `audit_log`; `role` on `workspace_members`; 4 performance indexes)**, 026 (migration_runs), 027 (recording_uploads), **028 (mismatches)**, **029 (api_keys, webhook_endpoints, webhook_deliveries, api_requests)**

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

## Accounting Engine Workstream (2026-03-28, ✅ complete)

Plan: `docs/superpowers/plans/2026-03-28-accounting-engine.md` (17 tasks)

### Task status

| # | Task | Status |
|---|------|--------|
| 1 | Migration 025 | ✅ Done |
| 2 | `db.ts` — withTransaction, DbClient, pool max=20 | ✅ Done |
| 3 | `idempotency.service.ts` — check/store/clean 24h keys | ✅ Done |
| 4 | GL service — PoolClient, period lock, control accounts, audit | ✅ Done |
| 5 | Audit service — workspaceEntityId param | ✅ Done |
| 6 | Invoice service — atomic createInvoice + recordPayment | ✅ Done |
| 7 | Bill service — atomic createBill + recordBillPayment | ✅ Done |
| 8 | Credit note, expense, approval services — atomic | ✅ Done |
| 9 | Quote, PO, opening balance, intercompany — atomic | ✅ Done |
| 10 | VAT engine service — explicit UK rules | ✅ Done |
| 11 | Cron monitoring — `cron_runs` table, Telegram alert | ✅ Done |
| 12 | Team roles — admin/accountant/staff, GL permission checks | ✅ Done |
| 13 | Accrual journals — draft mode, balance warning, auto-reversal cron | ✅ Done |
| 14 | Prepayment tracking — Dr Prepayments 1300, monthly release cron | ✅ Done |
| 15 | GL integrity diagnostic in health report | ✅ Done |
| 16 | Journal UI — Reverse button, Draft badge + Post action | ✅ Done |
| 17 | Build & deploy | ✅ Done (2026-03-29, 48/48 MCP tests pass) |

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

## Remaining Work — Launch Blockers

Every item below must be complete before 22accounting launches publicly.

| # | Workstream | Status | Detail |
|---|-----------|--------|--------|
| 1 | Help articles | ✅ 51 accounting + 7 API written (2026-03-31) | See `apps/26help/CLAUDE.md` |
| 2 | Help automation (weekly cron) | ✅ Built (2026-03-31) | `scripts/update-help-articles.sh`, cron `0 9 * * 1` |
| 3 | Granular permissions (~40 routes) | ✅ Done (2026-03-31) | 42 route files, 18 permission modules, 128/128 MCP tests |
| 4 | Mismatch flagging (PO-bill + bank-invoice) | ✅ Done (2026-03-31) | migration 028, service + routes + integration hooks |
| 5 | Migration 026 numbering conflict | ✅ Already resolved | 026=migration_runs, 027=recording_uploads, no conflict |
| 6 | Developer API + Webhooks (15 tasks) | ✅ Done (2026-03-31) | migration 029, API key auth, webhooks, v1 routes, settings UI |
| 7 | Help videos (every article needs a recording) | 0/47 recorded | See `apps/26help/CLAUDE.md` |

### Granular Permissions (✅ Complete 2026-03-31)

`checkPermission()` expanded from 7 route handlers to 42 files (92 total checks). 18 permission modules in `WorkspacePermissions` interface. Team page shows all modules in the permission matrix.

**Files changed:**
- `src/lib/auth.ts` — expanded `WorkspacePermissions` (6 → 18 modules)
- `src/lib/team-defaults.ts` — expanded `DEFAULT_PERMISSIONS` (all new modules: `view: true`, write actions `false`)
- `app/dashboard/team/page.tsx` — `MODULE_CONFIG` expanded (6 → 18 entries)

**Routes excluded from permissions**: `auth/*`, `workspace/*`, `team/*` (owner-only), `account/*`, `user/*`, `accountant/*` (own access model), Stripe `webhooks/*`, `recordings/*` (user-level), `period-locks/*` and `year-end/*` (admin-only via role check), `comments/*` and `attachments/*` (follow parent entity permissions).

### Mismatch Flagging (✅ Complete 2026-03-31)

PO-to-bill and bank-to-invoice amount discrepancy tracking. Migration `028_mismatches.sql`.

**Files:**
- `src/lib/mismatch.service.ts` — `detectBillPOMismatch` (threshold: diff > £1 AND > 2%), `detectBankMismatch`, `getMismatches`, `resolveMismatch`, `getMismatchCount`
- `app/api/mismatches/route.ts` — GET list (tier-gated to `mismatch_flagging`)
- `app/api/mismatches/[id]/route.ts` — PATCH resolve/ignore

**Integration hooks** (fire-and-forget, non-blocking):
- `app/api/bills/route.ts` POST — calls `detectBillPOMismatch()` if `poId` present
- `app/api/banking/[id]/match/route.ts` POST — calls `detectBankMismatch()` after invoice/bill match

---

## All Feature Plans & Specs

**Specs** (design docs): `docs/superpowers/specs/`
**Plans** (implementation plans): `docs/superpowers/plans/`

| Workstream | Spec | Plan | Status |
|------------|------|------|--------|
| Accounting Engine | `2026-03-26-accounting-engine-design.md` | `2026-03-28-accounting-engine.md` | ✅ Complete (2026-03-29) |
| UI Animations (Framer Motion) | — | `2026-03-28-ui-animations.md` | ✅ Complete (2026-03-30) |
| Help System (apps/26help) | — | `2026-03-28-help-system.md` | ✅ Complete (2026-03-30) |
| Migration Tool (Xero/QB import) | `2026-03-26-migration-tool-design.md` | `2026-03-28-migration-tool.md` | ✅ Complete (2026-03-30) |
| Recording System (screen capture) | `2026-03-26-recording-system-design.md` | `2026-03-28-recording-system.md` | ✅ Complete (2026-03-30) |
| Developer API + Webhooks | `2026-03-26-developer-api-design.md` | `2026-03-28-developer-api.md` | ✅ Complete (2026-03-31) |
| Granular Permissions | — | `2026-03-31-blockers-3-4-6.md` | ✅ Complete (2026-03-31) |
| Mismatch Flagging | — | `2026-03-31-blockers-3-4-6.md` | ✅ Complete (2026-03-31) |

---

## Developer API + Webhooks Workstream (✅ Complete 2026-03-31)

**Plan:** `docs/superpowers/plans/2026-03-28-developer-api.md` (15 tasks)
**Spec:** `docs/superpowers/specs/2026-03-26-developer-api-design.md`
**Migration:** `029_api_keys.sql` (4 tables: `api_keys`, `webhook_endpoints`, `webhook_deliveries`, `api_requests`)

### What was built

- **API key auth layer:** Bearer token → SHA-256 hash → `api_keys` table lookup. Key format: `rly_` + 64 hex chars. Auth runs in route handlers via `requireApiKeyContext()` in `v1-helpers.ts` (not middleware — Edge Runtime can't use Node.js `crypto`).
- **Versioned public API:** 15 route files under `app/api/v1/` (invoices, bills, customers, suppliers, expenses, reports, webhooks, keys). Each validates key + scopes + rate limits via `v1-helpers.ts`.
- **Scoped access:** 11 scopes (`invoices:read/write`, `customers:read/write`, etc.). IP allowlist optional per key.
- **Sandbox/test mode:** Keys with `is_test_mode=TRUE` skip DB writes; response includes `"test": true`.
- **Rate limiting:** In-memory sliding window in `rate-limiter.ts`. Tier-based: 30/min (invoicing) → 600/min (corporate).
- **Webhook delivery:** `dispatchWebhookEvent()` in `webhook.service.ts` fires async on invoice/bill/customer/supplier/expense events. Exponential backoff (6 attempts). Dead-letter after failures.
- **Settings UI:** 3 tabs on `/dashboard/settings`: General, API Keys (`ApiKeysPanel.tsx`), Webhooks (`WebhooksPanel.tsx`). Cookie-auth management routes at `/api/v1/keys/` and `/api/webhooks-ui/`.
- **Webhook event hooks:** Added to `invoice.service.ts`, `bill.service.ts`, `customer.service.ts`, `supplier.service.ts`, `expense_approval.service.ts` (all fire-and-forget).

### Key files

| File | Purpose |
|------|---------|
| `src/lib/api-key.service.ts` | `generateApiKey`, `validateApiKey`, `rotateApiKey`, `revokeApiKey`, `listApiKeys`, `logApiRequest` |
| `src/lib/webhook.service.ts` | `createWebhookEndpoint`, `dispatchWebhookEvent`, `processDelivery`, `processPendingDeliveries`, `retryDeadLettered` |
| `src/lib/rate-limiter.ts` | `checkRateLimit` — in-memory sliding window, tier-based limits |
| `src/lib/v1-helpers.ts` | `requireApiKeyContext` (validates key + rate limit), `requireScope`, `apiSuccess`, `apiError`, `parseListParams` |
| `src/components/settings/ApiKeysPanel.tsx` | API key management UI |
| `src/components/settings/WebhooksPanel.tsx` | Webhook endpoint management UI |
| `src/components/settings/SettingsTabs.tsx` | Tab wrapper for settings page |

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

**Status: ✅ Complete (2026-03-30)** — 48/48 MCP tests pass after fix.

**Critical fix applied:** `Card.tsx` and `Progress.tsx` needed `'use client'` added — any component that imports from `framer-motion` must be a client component or Next.js throws `createMotionComponent() from the server`.

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

## Help Centre — Product Launch Requirement

Full documentation lives in `apps/26help/CLAUDE.md`. Summary:

- **Live at**: `help.relentify.com/accounting` — container `26help`, port 3026
- **Content**: `apps/26help/content/accounting/` — one MDX file per feature
- **Status**: ✅ All articles written (51 accounting + 7 API, 2026-03-31). Videos not yet recorded.
- **Videos**: embed via `video` frontmatter + `<VideoGuide>` component. Currently stripped from articles so pages look complete without them.
- **Automation**: ✅ `scripts/update-help-articles.sh` — weekly cron (Mon 09:00) runs MCP tests, invokes Claude Code CLI to review and update stale articles automatically.

**This must be complete before accounting launches publicly.** See `apps/26help/CLAUDE.md` for the full article checklist, video recording guidelines, and automation spec.

---

## MCP Test Expansion (2026-03-31)

**MCP server:** `/opt/infra/mcp/22accounting-mcp/`
**Current result:** 128/128 passing (2026-03-31) — all API routes covered, permissions + mismatch + dev API verified
**Approach:** Single `run_tests.py` — monolithic sequential runner, `chk()`/`get_id()`/`chk_smoke()` pattern.

### New tests on existing tool files (functions exist, not called in runner)

| Area | Current | Target | New Tests |
|------|---------|--------|-----------|
| Customers | 2 | 4 | update, delete |
| Suppliers | 1 | 4 | list, update, delete |
| Invoices | 4 | 7 | list, get, stats |
| Quotes | 2 | 4 | list, send |
| Bills | 2 | 4 | list, get |
| Credit Notes | 2 | 3 | list |
| Expenses & Mileage | 5 | 10 | list_expenses, reject (2nd), list_mileage, approve_mileage, get_approval_settings |
| Purchase Orders | 3 | 7 | list, get, approve, get_settings |
| Projects | 1 | 4 | list, update, delete |
| COA | 1 | 3 | create_account, deactivate |
| Journals | 2 | 3 | list |
| Banking | 1 | 3 | list_transactions, connect_mock |
| Reports | 10 | 11 | consolidated |
| Period Locks | 1 | 4 | get, overrides, earliest_open |
| Attachments | 2 | 4 | list, delete |
| Comments | 2 | 4 | list, update |
| Multi-Entity | 1 | 3 | list_entities, intercompany |
| Cron | 1 | 4 | reminders, accrual_reversals, prepayment_release |

### New tool files needed

| File | Routes | Test Type |
|------|--------|-----------|
| `tools/workspace.py` | list, switch, leave | Real |
| `tools/user_profile.py` | GET/PATCH user, change-password, auth/me | Real |
| `tools/auth_tools.py` | logout (run last), account export/delete | Smoke |
| `tools/openbanking.py` | connect, callback, disconnect, sync | Smoke (expect 400/401) |
| `tools/hmrc.py` | connect, callback, disconnect, obligations, client-info, vat/submit | Smoke (expect 400/401) |
| `tools/recordings.py` | list, upload, stream | Smoke (expect 200 empty or 400) |
| `tools/year_end.py` | preview, close | Real |

Extend existing: `tools/stripe.py` (checkout/connect/disconnect/callback/status), `tools/import_data.py` (template downloads, OB template), `tools/cron.py` (accrual_reversals, prepayment_release), `tools/team.py` (wire into runner)

### New tool file details

| File | Tests | Type | Details |
|------|-------|------|---------|
| `tools/user_profile.py` | 4 | Real | get_user, update_user, change_password (smoke—no real pw), auth_me |
| `tools/auth_tools.py` | 3 | Smoke | export_account, delete_account (expect 400, don't delete), logout (very last) |
| `tools/workspace.py` | 3 | Real | list, switch, leave (smoke on non-default entity) |
| `tools/openbanking.py` | 4 | Smoke | connect/disconnect/callback/sync (expect 400/401 without TrueLayer) |
| `tools/hmrc.py` | 6 | Smoke | connect/disconnect/callback/obligations/client-info/vat-submit (expect 400/401) |
| `tools/year_end.py` | 2 | Real | preview, close |
| `tools/recordings.py` | 3 | Smoke | list (expect 200 empty), upload (expect 400 no file), stream (expect 404) |

Extend existing: `stripe.py` +6 smoke (checkout/connect/disconnect/callback/status/webhook), `cron.py` +2 (accrual_reversals, prepayment_release), `import_data.py` +2 (template download, OB template)

### Smoke test pattern

New `chk_smoke()` helper — passes if response is NOT a server error (500/502/503). Asserts route exists and handles gracefully (400/401/403/404 all count as pass).

### Final test count target: ~126

- Existing expanded: 48 → ~87
- New tool files: ~25
- Extended existing files: ~10
- Smoke tests: ~22

### Test ordering constraints
- Supplier delete after bills (no CASCADE)
- Customer delete after invoices/quotes/credit notes
- Auth logout = very last test (invalidates token)
- Account delete: smoke only, do NOT actually delete

### Phase 2 — Mock Server for External Services (complete, 2026-03-31)

**Result:** 128/128 passing. OpenBanking sync, HMRC obligations, HMRC VAT submit, and quote send all now return real 200s via mock server. Stripe checkout remains smoke (needs `STRIPE_MOCK_HOST` env var — implemented but not yet fully tested for checkout flow).
**Mock server:** `/opt/infra/mcp/22accounting-mcp/mock_server.py` on port 9999
**iptables rule required:** `iptables -I INPUT -s 172.18.0.0/16 -p tcp --dport 9999 -j ACCEPT`
**Env backup:** `.env.bak` has original external service URLs

**Goal:** Replace smoke tests with real end-to-end tests using a local mock HTTP server.

**Architecture:** Python `http.server` on port 9999 inside the MCP venv. Mimics Stripe, HMRC, and TrueLayer API responses. The 22accounting app's env vars get pointed at `http://localhost:9999` instead of real APIs.

#### Mock server: `mock_server.py`

Single Python file at `/opt/infra/mcp/22accounting-mcp/mock_server.py`. Routes incoming requests by path prefix:

| Prefix | Mocks | Key Endpoints |
|--------|-------|---------------|
| `/stripe/` | Stripe API | `POST /v1/customers` (create customer), `POST /v1/checkout/sessions` (create session), `GET /v1/accounts/:id` (retrieve account), `POST /oauth/deauthorize` |
| `/hmrc/` | HMRC MTD API | `GET /organisations/vat/:vrn/obligations` (VAT obligations), `POST /organisations/vat/:vrn/returns` (submit return), `POST /oauth/token` (refresh token) |
| `/truelayer/` | TrueLayer API | `POST /connect/token` (refresh token), `GET /data/v1/accounts/:id/balance`, `GET /data/v1/accounts/:id/transactions` |

Returns canned JSON responses with correct shapes. Logs all requests for assertion in tests.

#### Env var overrides

Set these in the 22accounting `.env` during test runs (restore originals after):

```
HMRC_BASE_URL=http://host.docker.internal:9999/hmrc
TRUELAYER_API_URL=http://host.docker.internal:9999/truelayer
STRIPE_SECRET_KEY=sk_test_mock_key
STRIPE_CLIENT_ID=ca_mock_client
```

Note: `host.docker.internal` lets the container reach the host's port 9999. On Linux, add `--add-host=host.docker.internal:host-gateway` to docker-compose.yml or use the infra_default network IP.

Alternatively: run mock server inside Docker on the `infra_default` network so 22accounting can reach it by container name.

#### DB seeding for external services

Add to `setup_test_env()`:

```python
# HMRC: seed tokens so obligations/submit routes proceed past "not connected" check
db_execute("""UPDATE users SET vat_number='123456789',
    hmrc_access_token='mock_token', hmrc_refresh_token='mock_refresh',
    hmrc_token_expires_at=NOW() + interval '1 hour'
    WHERE id=%s""", [user_id])

# Stripe: seed customer ID so checkout/disconnect/status routes proceed
db_execute("""UPDATE users SET stripe_customer_id='cus_mock_123',
    stripe_account_id='acct_mock_456', stripe_account_status='verified'
    WHERE id=%s""", [user_id])

# OpenBanking: seed a bank connection so sync route proceeds
db_execute("""INSERT INTO bank_connections
    (id, user_id, entity_id, truelayer_account_id, access_token, refresh_token,
     token_expires_at, display_name, account_type, currency)
    VALUES (%s, %s, %s, 'acc_mock', 'mock_token', 'mock_refresh',
     NOW() + interval '1 hour', 'Mock Current Account', 'CURRENT_ACCOUNT', 'GBP')""",
    [str(uuid.uuid4()), user_id, entity_id])
```

#### Routes that need NO outbound call (DB-only, already fully tested)

| Route | Why no mock needed |
|-------|--------------------|
| hmrc/disconnect | Only clears DB tokens |
| hmrc/client-info | Only writes device info to DB |
| openbanking/disconnect | Only deletes bank_connections row |
| webhooks/stripe | Only validates signature + updates DB |

#### Routes that need mock responses

| Route | Mock endpoint | Response shape |
|-------|---------------|----------------|
| hmrc/obligations | `GET /hmrc/organisations/vat/:vrn/obligations` | `{ obligations: [{ periodKey, start, end, due, status }] }` |
| hmrc/vat/submit | `POST /hmrc/organisations/vat/:vrn/returns` | `{ processingDate: "2026-03-31", formBundleNumber: "123456789" }` |
| openbanking/sync | `GET /truelayer/data/v1/accounts/:id/balance` | `{ results: [{ available: 5000, current: 5000 }] }` |
| openbanking/sync | `GET /truelayer/data/v1/accounts/:id/transactions` | `{ results: [{ transaction_id, timestamp, description, amount }] }` |
| stripe/checkout | `POST /stripe/v1/checkout/sessions` | `{ id: "cs_mock", url: "http://localhost:9999/checkout" }` |
| stripe/status | `GET /stripe/v1/accounts/:id` | `{ id: "acct_mock", charges_enabled: true, payouts_enabled: true }` |
| stripe/disconnect | `POST /stripe/oauth/deauthorize` | `{ stripe_user_id: "acct_mock" }` |

#### Implementation tasks

1. Create `mock_server.py` with ThreadingHTTPServer on port 9999
2. Add route handlers for all 7 mock endpoints above
3. Add DB seeding to `setup_test_env()` for HMRC tokens, Stripe IDs, bank connection
4. Add DB cleanup for new seeded rows to `teardown_test_env()`
5. Update `run_tests.py`: start mock server in background thread before tests, stop after
6. Update env var handling: either patch env before container start, or use `http_client` to pass mock URLs
7. Convert smoke tests to real `chk()` assertions (expect 200, not just "not 500")
8. Add `teardown_test_env()` entries for: `bank_connections`, HMRC token columns, Stripe columns
9. Test end-to-end: all 128 tests still green, smoke tests now return real 200s

#### Key decision: env var injection

The 22accounting container reads env vars at startup. Two options:
- **A) Restart container with mock URLs** — cleanest but slow (5s restart per test run)
- **B) Override at service level** — if services read `process.env` per-request (they do for HMRC/TrueLayer), just changing `.env` and restarting once works
- **Recommended:** Change `.env` once, rebuild/restart, run all tests, restore `.env` after. The mock server stays running on the host during the test run.

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
