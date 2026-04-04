# Design: Help Articles, Developer API, Granular Permissions, Mismatch Flagging

**Date**: 2026-03-30
**Apps**: 26help, 22accounting

---

## 1. Help Centre — Remaining Articles

### Scope
Write 27 remaining MDX articles in `apps/26help/content/accounting/` plus create `content/api/` category with developer API docs.

### Articles to write

**Customers & Suppliers**: update-customer, update-supplier
**Invoicing**: void-invoice, void-credit-note, attachments, comments
**Expenses**: mileage-expense, expense-approval-settings
**Purchase Orders**: create-purchase-order, submit-purchase-order, approve-purchase-order, purchase-order-settings
**Projects**: create-project, assign-costs-to-project
**Chart of Accounts**: chart-of-accounts, create-account, deactivate-account
**Banking**: connect-bank, sync-transactions
**Reports**: aged-receivables, aged-payables, general-ledger, cash-flow, kpi-dashboard, health-score, custom-report
**Multi-Entity & Access**: multi-entity, accountant-access, period-lock
**Settings**: company-settings, audit-log

### Format
Same as existing: frontmatter (title, description, category, order, video, appRoute, relatedArticles) + MDX body with "What this does", "When to use it", "Step by step" sections + VideoGuide component.

### Video
Video filenames use `<slug>.webm` in frontmatter. Actual recordings are a separate task — articles ship with the placeholder path so VideoGuide renders once files are uploaded.

---

## 2. Developer API

### Database

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,        -- first 8 chars, shown in UI
  key_hash TEXT NOT NULL,           -- SHA-256 of full key
  scopes TEXT[] DEFAULT '{}',       -- future: fine-grained scopes
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

### Key format
`rlk_<32 random hex chars>` — prefix `rlk_` makes keys identifiable. Only shown once at creation. Stored as SHA-256 hash.

### Auth flow
1. Check `Authorization: Bearer rlk_...` header
2. Hash the key, look up in `api_keys` where `revoked_at IS NULL`
3. If found, set auth context (userId from api_keys row, actorId = userId, no workspace permissions — API keys act as owner)
4. If not found, fall back to cookie auth
5. Update `last_used_at`

### Rate limiting
Simple per-key counter in a `rate_limits` table or in-memory Map. 100 requests/minute per key. Return 429 with `Retry-After` header.

### Endpoints
- `POST /api/developer/keys` — create key (returns full key once)
- `GET /api/developer/keys` — list keys (prefix + name + last_used only)
- `DELETE /api/developer/keys/[id]` — revoke key
- `GET /api/developer/docs` — redirect to help.relentify.com/api

### UI
Settings page gets a "Developer" tab/section with key management.

### Help articles (content/api/)
- `getting-started` — auth, base URL, rate limits
- `invoices-api` — CRUD endpoints for invoices
- `customers-api` — CRUD for customers
- `suppliers-api` — CRUD for suppliers
- `bills-api` — CRUD for bills
- `reports-api` — report endpoints
- `webhooks-api` — future webhook docs (placeholder)

### Tier gating
API key creation requires `sole_trader` tier or above.

---

## 3. Granular Permissions

### Current state
- `WorkspacePermissions` type has 6 modules: invoices, bills, banking, reports, settings, customers
- `checkPermission()` exists but only called in 9 routes
- Team members can be invited with custom permissions

### Changes

**Expand WorkspacePermissions type** to add:
```ts
expenses:     { view: boolean; create: boolean; approve: boolean };
quotes:       { view: boolean; create: boolean };
creditNotes:  { view: boolean; create: boolean };
journals:     { view: boolean; create: boolean };
po:           { view: boolean; create: boolean; approve: boolean };
projects:     { view: boolean; create: boolean };
mileage:      { view: boolean; create: boolean };
vat:          { view: boolean; submit: boolean };
coa:          { view: boolean; manage: boolean };
audit:        { view: boolean };
entities:     { view: boolean; manage: boolean };
```

**Wire checkPermission into all API routes** — every route handler that isn't already covered needs a `checkPermission(auth, module, action)` call after auth check.

**Default permissions** — new modules default to `view: true`, all write actions `false`.

**Team page UI** — permissions editor: toggle grid showing each module and its actions. Already have the PATCH endpoint for updating.

---

## 4. Mismatch Flagging

### Database

```sql
CREATE TABLE mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- 'po_bill_amount', 'bank_invoice_amount', 'bank_bill_amount'
  severity TEXT DEFAULT 'warning',  -- 'warning' | 'critical'
  source_type TEXT NOT NULL,        -- 'bill', 'bank_transaction'
  source_id UUID NOT NULL,
  reference_type TEXT NOT NULL,     -- 'purchase_order', 'invoice', 'bill'
  reference_id UUID NOT NULL,
  source_amount DECIMAL(12,2),
  reference_amount DECIMAL(12,2),
  difference DECIMAL(12,2),
  message TEXT,
  status TEXT DEFAULT 'open',       -- 'open', 'resolved', 'ignored'
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mismatches_user_status ON mismatches(user_id, status);
```

### Detection triggers
1. **Bill create/update**: If bill has `po_id`, compare bill total vs PO total. Flag if diff > £1 AND > 2%.
2. **Bank reconciliation**: When matching a transaction, compare transaction amount vs invoice/bill amount. Flag if partial match (>80% of amount but not exact).

### API
- `GET /api/mismatches` — list open/all mismatches
- `PATCH /api/mismatches/[id]` — resolve or ignore with note
- Mismatch count returned in `GET /api/health` response

### UI
- Dashboard shows mismatch count badge
- Clicking navigates to filtered view of mismatches
- Each mismatch links to its source and reference documents

### Tier gating
`small_business` and above (matches `mismatch_flagging` in tiers.ts).

---

## Build Order

1. Help articles (26help content only — no code changes)
2. Developer API (DB + auth + endpoints + help articles)
3. Granular permissions (expand type + wire all routes + team UI)
4. Mismatch flagging (DB + detection + API + UI)

Each step: build → test with MCP → update CLAUDE.md → commit.
