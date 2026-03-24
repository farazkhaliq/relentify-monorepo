# 22accounting MCP Server — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Overview

A standalone Python MCP server at `/opt/22accounting-mcp/` that gives Claude the ability to test every built feature of the 22accounting app and fix whatever is broken. It combines two access layers: authenticated HTTP calls to the running app, and direct PostgreSQL access for setup, teardown, and GL integrity checks.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Python | Simpler to iterate independently of the monorepo |
| HTTP client | httpx | Async-capable, clean API |
| Auth | JWT minting via PyJWT | Bypasses rate-limited login endpoint; reads JWT_SECRET from app's .env |
| DB access | psycopg2-binary | Direct pg access for setup/teardown/diagnostics |
| Test isolation | Dedicated test user (`test@22accounting-mcp.internal`, `corporate` tier) | Avoids corrupting real data; allows destructive operations |
| Base URL | `http://22accounting:3022` | Docker internal network; no TLS overhead |
| Config source | `/opt/relentify-monorepo/apps/22accounting/.env` | Single source of truth; no duplication |

---

## Prerequisites

1. **Next.js upgrade** — 22accounting is currently stopped due to CVE GHSA-9qr9-h5gf-34mp (Next.js 15.1.0 RCE). Must upgrade to 15.2.3 and rebuild before HTTP tools are usable.
2. **Container running** — `docker ps` should show `22accounting` healthy on port 3022.
3. **DB accessible** — `infra-postgres` must be reachable (always true on this VPS).

---

## File Structure

```
/opt/22accounting-mcp/
├── server.py           # Entry point — MCP server, registers all tools
├── config.py           # Loads .env from app path; exposes JWT_SECRET, DATABASE_URL, BASE_URL
├── auth.py             # mint_token(user_id) → JWT string for Cookie header
├── http_client.py      # Authenticated httpx wrapper; all HTTP tools go through this
├── db.py               # psycopg2 connection pool for direct DB queries
├── tools/
│   ├── __init__.py
│   ├── setup.py        # setup_test_env, teardown_test_env, mint_token
│   ├── customers.py    # create_customer, list_customers, update_customer, delete_customer
│   ├── suppliers.py    # create_supplier, list_suppliers, update_supplier, delete_supplier
│   ├── invoices.py     # create_invoice, list_invoices, get_invoice, void_invoice, send_invoice, record_invoice_payment
│   ├── quotes.py       # create_quote, list_quotes, send_quote, convert_quote_to_invoice
│   ├── bills.py        # create_bill, list_bills, get_bill, record_bill_payment
│   ├── credit_notes.py # create_credit_note, list_credit_notes, void_credit_note
│   ├── expenses.py     # create_expense, list_expenses, approve_expense, reject_expense,
│   │                   # create_mileage, list_mileage, approve_mileage, reject_mileage,
│   │                   # get_pending_approvals, get_expense_approval_settings, update_expense_approval_settings
│   ├── purchase_orders.py  # create_po, list_pos, get_po, submit_po_for_approval, approve_po,
│   │                       # reject_po, set_po_approver_mapping, get_po_settings
│   ├── projects.py     # create_project, list_projects, update_project, delete_project
│   ├── coa.py          # list_coa, create_coa_account, deactivate_coa_account
│   ├── journals.py     # create_journal_entry, list_journal_entries, reverse_journal_entry
│   ├── banking.py      # list_bank_accounts, list_bank_transactions, reconcile_transaction, sync_bank
│   ├── reports.py      # get_pl, get_balance_sheet, get_trial_balance, get_gl,
│   │                   # get_aged_receivables, get_aged_payables, get_kpi_report,
│   │                   # get_cashflow_forecast, get_health_score, get_custom_report,
│   │                   # get_dashboard, get_consolidated_report
│   ├── vat.py          # get_vat_return (calculation only — no HMRC submission)
│   ├── period_locks.py # lock_period, unlock_period, get_period_lock,
│   │                   # grant_lock_override, test_period_lock_enforcement
│   ├── import_data.py  # import_data (customers/suppliers/invoices/bills/expenses via CSV)
│   ├── attachments.py  # upload_attachment, list_attachments, delete_attachment
│   ├── comments.py     # create_comment, list_comments, reply_to_comment, get_conversations
│   ├── team.py         # invite_team_member, accept_team_invite, list_team_members, update_team_member_role
│   ├── multi_entity.py # create_entity, list_entities, create_intercompany_transaction, list_intercompany_transactions, get_consolidated_report
│   ├── accountant.py   # setup_accountant_account, invite_client, accept_client_invite,
│   │                   # impersonate_client, get_accountant_portal, get_referral_earnings
│   ├── audit.py        # get_audit_log
│   ├── settings.py     # update_company_settings
│   ├── cron.py         # trigger_po_escalation_cron, trigger_payment_reminders_cron
│   ├── stripe.py       # simulate_stripe_payment_webhook (conditional — needs STRIPE_WEBHOOK_SECRET)
│   ├── ui_checks.py    # check_page_routes — httpx GET all ~25 routes, assert 200 + expected HTML content
│   ├── ui_browser.py   # Playwright interactive tests (conditional — skips if playwright not installed)
│   │                   # test_dashboard_renders, test_date_picker, test_invoice_form,
│   │                   # test_approval_modal, test_inline_project_create, test_chart_renders
│   └── diagnostics.py  # health_check, db_query, check_gl_integrity
└── requirements.txt    # mcp, PyJWT, psycopg2-binary, httpx, python-dotenv
                        # optional: playwright (install separately: playwright install chromium)
```

---

## Tool Inventory (~98 tools)

### Setup (3 tools)
| Tool | Method | Description |
|------|--------|-------------|
| `setup_test_env` | DB | Creates test user (corporate tier) + entity + seeds COA. Returns user_id, entity_id. |
| `teardown_test_env` | DB | Hard-deletes all data scoped to test user_id. |
| `mint_token` | — | Mints a relentify_token JWT for any user_id. |

### Customers (4 tools)
`create_customer`, `list_customers`, `update_customer`, `delete_customer`

### Suppliers (4 tools)
`create_supplier`, `list_suppliers`, `update_supplier`, `delete_supplier`

### Invoices (6 tools)
`create_invoice`, `list_invoices`, `get_invoice`, `void_invoice`, `send_invoice`, `record_invoice_payment`

Note: `create_invoice` with qty=1, unit_price=10000 verifies the price formatting bug fix (#5).

### Quotes (4 tools)
`create_quote`, `list_quotes`, `send_quote`, `convert_quote_to_invoice`

### Bills (4 tools)
`create_bill`, `list_bills`, `get_bill`, `record_bill_payment`

Note: `create_bill` accepts `coa_account_id` (tests COA nominal account selector, #12) and `invoice_date` (#13).

### Credit Notes (3 tools)
`create_credit_note`, `list_credit_notes`, `void_credit_note`

### Expenses & Mileage (11 tools)
`create_expense`, `list_expenses`, `approve_expense`, `reject_expense`, `create_mileage`, `list_mileage`, `approve_mileage`, `reject_mileage`, `get_pending_approvals`, `get_expense_approval_settings`, `update_expense_approval_settings`

### Purchase Orders (8 tools)
`create_po`, `list_pos`, `get_po`, `submit_po_for_approval`, `approve_po`, `reject_po`, `set_po_approver_mapping`, `get_po_settings`

### Projects (4 tools)
`create_project`, `list_projects`, `update_project`, `delete_project`

### Chart of Accounts (3 tools)
`list_coa`, `create_coa_account`, `deactivate_coa_account`

### Journal Entries (3 tools)
`create_journal_entry`, `list_journal_entries`, `reverse_journal_entry`

### Banking (4 tools)
`list_bank_accounts`, `list_bank_transactions`, `reconcile_transaction`, `sync_bank`

### Reports (12 tools)
`get_pl`, `get_balance_sheet`, `get_trial_balance`, `get_gl`, `get_aged_receivables`, `get_aged_payables`, `get_kpi_report`, `get_cashflow_forecast`, `get_health_score`, `get_custom_report`, `get_dashboard`, `get_consolidated_report`

### VAT (1 tool)
`get_vat_return` — tests the 9-box calculation only. HMRC submission excluded (would hit live HMRC).

### Period Locks (5 tools)
`lock_period`, `unlock_period`, `get_period_lock`, `grant_lock_override`, `test_period_lock_enforcement`

Note: `test_period_lock_enforcement` locks a period then attempts to create an invoice/bill/expense in it, expects HTTP 403 with `PERIOD_LOCKED`.

### Import (2 tools)
`import_data(record_type, csv_content)` — supports customers, suppliers, invoices, bills, expenses.
`import_opening_balances(xlsx_bytes)` — uploads opening balances XLSX. `trigger_year_end_close()` — calls year-end close endpoint (Settings → Period Locks). Both test CLAUDE.md item #35.

### Attachments (3 tools)
`upload_attachment(record_type, record_id, file_bytes, mime_type)`, `list_attachments`, `delete_attachment`

Tested against all three supported record types: bills, expenses/mileage, bank_transactions. Requires `corporate` tier (test user satisfies this — `corporate` ⊇ `small_business` which is the minimum for `capture_bills_receipts`).

### Comments (4 tools)
`create_comment`, `list_comments`, `reply_to_comment`, `get_conversations`

### Team (4 tools)
`invite_team_member`, `accept_team_invite`, `list_team_members`, `update_team_member_role`

Note: `accept_team_invite` reads the invite token directly from `workspace_members.invite_token` (indexed at `idx_workspace_members_token`), then calls `/dashboard/team/accept?token=<token>`. Avoids email delivery entirely.

### Multi-Entity (4 tools)
`create_entity`, `list_entities`, `create_intercompany_transaction`, `list_intercompany_transactions`

Note: `get_consolidated_report` lives in `reports.py` only — not duplicated here.

### Accountant Access (6 tools)
`setup_accountant_account`, `invite_client`, `accept_client_invite`, `impersonate_client`, `get_accountant_portal`, `get_referral_earnings`

### Audit Log (1 tool)
`get_audit_log`

### Company Settings (1 tool)
`update_company_settings` — tests registered_address, bank_account_name, sort_code, account_number (#48).

### UI — Page Checks (1 tool)
`check_page_routes()` — httpx GETs all ~25 authenticated routes with a valid JWT cookie. Asserts HTTP 200, no 500, and presence of expected landmark text in the server-rendered HTML. Covers every named page in CLAUDE.md. Fast, zero RAM overhead. Example assertions:
- `/dashboard` → contains `"net position"` (dashboard rebuild hero, #1)
- `/dashboard/invoices/new` → contains `"New Invoice"` (invoice page, #2)
- `/dashboard/quotes/new` → contains `"New Quote"` (quote page, #6)
- `/dashboard/team` → contains `"Team"` (team invite page, #7)
- `/dashboard/chart-of-accounts` → contains `"Chart of Accounts"`
- `/dashboard/reports/health` → contains `"health score"`
- `/dashboard/conversations` → contains `"Conversations"`
- ... all other routes

### UI — Browser Tests (6 tools — conditional on Playwright install)
All tools skip gracefully if `playwright` is not installed, returning `{skipped: true, reason: "playwright not installed — run: pip install playwright && playwright install chromium"}`.

Auth: each browser test sets `document.cookie = "relentify_token=<jwt>"` before navigating, bypassing the login page.

| Tool | What it tests | Priority 5 item |
|------|--------------|-----------------|
| `test_dashboard_renders` | Bank balance line chart + cashflow bar chart present in DOM; forecast hero shows a £ value | #1 Dashboard rebuild |
| `test_date_picker` | Click a date field on invoice/new → Popover+Calendar opens, select a date → field value updates | #4 Date pickers |
| `test_invoice_form` | Fill invoice form, click `+New` project button → modal opens, create project → auto-selected in dropdown | #3 Inline project creation |
| `test_approval_modal` | Navigate to expenses, click Reject on pending expense → modal opens with reason field | Priority 3 expense approval |
| `test_period_lock_modal` | Lock a period via API, navigate to invoice detail → `PeriodLockedModal` appears | Priority 3 period lock UI |
| `screenshot_all_pages` | Navigates all 25 routes, takes a screenshot of each → saves to `/opt/22accounting-mcp/screenshots/` | Visual reference |

### Stripe (1 tool — conditional)
`simulate_stripe_payment_webhook(invoice_id)` — signs a `invoice.payment_succeeded` payload with `STRIPE_WEBHOOK_SECRET` and POSTs to `/api/stripe/webhook`. Skips if `STRIPE_WEBHOOK_SECRET` absent.

### TrueLayer (conditional tools in banking module)
`connect_bank_mock()` — initiates OAuth with `uk-cs-mock` provider. Skips if `TRUELAYER_CLIENT_ID`/`TRUELAYER_CLIENT_SECRET` absent.

### HMRC VAT (conditional tool in vat module)
`submit_vat_return(period_key)` — submits to HMRC sandbox. Skips if `HMRC_CLIENT_ID` or `HMRC_SANDBOX=true` absent.

### Cron Endpoints (2 tools)
`trigger_po_escalation_cron` — calls `/api/cron/po-escalation` with `x-cron-secret` header.
`trigger_payment_reminders_cron` — calls `/api/cron/reminders` with `x-cron-secret` header. (Route confirmed at `app/api/cron/reminders/route.ts`.)

### Diagnostics (3 tools)
`health_check`, `db_query(sql)` (SELECT only), `check_gl_integrity` — verifies every journal_entry has balanced debits/credits via direct SQL.

---

## Data Flow

### Typical HTTP tool call
```
Tool invoked (e.g. create_invoice)
  → auth.py: mint_token(user_id) using JWT_SECRET
  → http_client.py: POST http://22accounting:3022/api/invoices
      Headers: Cookie: relentify_token=<jwt>
      Body: JSON payload
  → Parse response → return {ok, status, data} dict
```

### JWT payload minted
```json
{
  "userId": "<test_user_id>",
  "actorId": "<test_user_id>",
  "email": "test@22accounting-mcp.internal",
  "subscriptionPlan": "corporate",
  "iat": <now>,
  "exp": <now + 1 hour>
}
```
Field name confirmed as `subscriptionPlan` (camelCase) by inspecting `src/lib/auth.ts` — the `JWTPayload` interface uses `subscriptionPlan?: string`. Signed with HS256 (jsonwebtoken default) using `JWT_SECRET` from app's `.env`. Passed as `Cookie: relentify_token=<jwt>` — matching `getAuthUser()` which checks `relentify_client_token` first, falls through to `relentify_token`.

### setup_test_env SQL flow
1. `INSERT INTO users (id, email, name, subscription_plan) VALUES (gen_random_uuid(), 'test@22accounting-mcp.internal', 'MCP Test User', 'corporate') RETURNING id`
2. `INSERT INTO entities (id, user_id, name, currency) VALUES (gen_random_uuid(), $user_id, 'MCP Test Co', 'GBP') RETURNING id`
3. Seed COA using a fixed SQL constant list of the 42 standard UK accounts (COA ranges: ASSET 1000–1999, LIABILITY 2000–2999, EQUITY 3000–3999, INCOME 4000–4999, COGS 5000–6999, EXPENSE 7000–9998, SUSPENSE 9999). Do NOT copy from an existing entity (`LIMIT 1` is non-deterministic). The constants are defined in `setup.py` directly.
4. Return `{user_id, entity_id}`

### teardown_test_env SQL flow
Explicit FK-safe delete order (derived from schema.sql + all migrations):

```sql
DELETE FROM transaction_comments   WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM accountant_referral_earnings WHERE accountant_user_id = $user_id OR client_user_id = $user_id;
DELETE FROM accountant_clients     WHERE accountant_user_id = $user_id OR client_user_id = $user_id;
DELETE FROM accountant_invitations WHERE invited_by_user_id = $user_id OR invitee_email = 'test@22accounting-mcp.internal';
DELETE FROM attachment_data        WHERE attachment_id IN (SELECT id FROM attachments WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id));
DELETE FROM attachments            WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM journal_lines          WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id));
DELETE FROM journal_entries        WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM po_items               WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id));
DELETE FROM po_approver_mappings   WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM po_settings            WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM purchase_orders        WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM expense_approval_settings WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM mileage_claims         WHERE user_id = $user_id;
DELETE FROM expenses               WHERE user_id = $user_id;
DELETE FROM credit_note_items      WHERE credit_note_id IN (SELECT id FROM credit_notes WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id));
DELETE FROM credit_notes           WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM invoice_items          WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id = $user_id);
DELETE FROM invoices               WHERE user_id = $user_id;
DELETE FROM bank_transactions      WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM bank_connections       WHERE user_id = $user_id;
DELETE FROM reminder_logs          WHERE user_id = $user_id;
DELETE FROM workspace_members      WHERE owner_user_id = $user_id;
DELETE FROM audit_log              WHERE user_id = $user_id;
DELETE FROM intercompany_links     WHERE source_entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM chart_of_accounts      WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM projects               WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM suppliers              WHERE entity_id IN (SELECT id FROM entities WHERE user_id = $user_id);
DELETE FROM customers              WHERE user_id = $user_id;
DELETE FROM entities               WHERE user_id = $user_id;
DELETE FROM users                  WHERE id = $user_id;
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| HTTP 4xx | `{ok: false, status: 422, body: {...}}` — full error body for diagnosis |
| HTTP 403 PERIOD_LOCKED | Returned as-is — this is the expected signal for lock tests |
| HTTP 5xx | Full error including Next.js error body if available |
| App unreachable | `{ok: false, error: "22accounting not reachable at http://22accounting:3022 — is the container running?"}` |
| DB error | Full psycopg2 exception message |
| JWT minting fails (bad secret) | Clear message: "Failed to mint token — check JWT_SECRET in .env" |

---

## Conditional-Scope Features

These tools exist in the MCP but return `{ok: false, skipped: true, reason: "...not configured"}` if the relevant env vars are absent. Once the service is configured, the same tool runs normally.

### TrueLayer (banking module)
`connect_bank_mock()` — uses `TRUELAYER_PROVIDERS=uk-cs-mock` (already in `.env` per CLAUDE.md). Posts to the TrueLayer OAuth initiation endpoint; the mock provider completes without a browser redirect. Requires `TRUELAYER_CLIENT_ID` + `TRUELAYER_CLIENT_SECRET` in `.env`. Skips gracefully if absent.

`sync_bank()` — calls `/api/banking/sync` to pull transactions from a connected account. Works as long as a bank connection exists (created by `connect_bank_mock` or manually). Always available once a connection is in DB.

### HMRC VAT Submission (vat module)
`submit_vat_return(period_key)` — calls `/api/vat/submit`. Requires `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, and `HMRC_SANDBOX=true` in `.env` to target the HMRC sandbox API instead of live. Skips if unconfigured. The existing `get_vat_return` (9-box calculation) runs regardless.

### Stripe (new: stripe module)
`simulate_stripe_payment_webhook(invoice_id)` — constructs a `invoice.payment_succeeded` Stripe webhook payload, signs it with `STRIPE_WEBHOOK_SECRET` (from `.env`), and POSTs directly to `/api/stripe/webhook`. No browser or Stripe.js needed. Tests that the webhook handler marks the invoice paid and posts GL (Dr Bank / Cr Debtors). Skips if `STRIPE_WEBHOOK_SECRET` absent.

---

## Out of Scope (not testable via MCP)

| Feature | Reason |
|---------|--------|
| Sentry error monitoring | External service; no API to assert against. GL integrity tested indirectly via `check_gl_integrity`. |
| CSS/dark mode correctness | Pixel-accurate styling requires visual diffing tools — `screenshot_all_pages` produces screenshots for human review but cannot auto-assert colours or spacing. |
| Nav cleanup (dead links removed) | Verifiable by reading HTML from `check_page_routes` — if a link renders as `href="#"` or 404s it will be caught. |

---

## MCP Registration

Add to `~/.mcp.json`:
```json
"22accounting": {
  "command": "python3",
  "args": ["/opt/22accounting-mcp/server.py"]
}
```

Config is loaded from `/opt/relentify-monorepo/apps/22accounting/.env` at startup.

---

## Implementation Order

1. **Upgrade Next.js** — bump 15.1.0 → 15.2.3 in 22accounting's `package.json`, run `pnpm audit`, rebuild container
2. **Build MCP server** — all files in `/opt/22accounting-mcp/`, install requirements
3. **Register in `~/.mcp.json`**
4. **Test systematically** — `setup_test_env` → call each module in order → `teardown_test_env`
5. **Fix failures** — diagnose from HTTP error bodies + DB state, patch app code, rebuild
