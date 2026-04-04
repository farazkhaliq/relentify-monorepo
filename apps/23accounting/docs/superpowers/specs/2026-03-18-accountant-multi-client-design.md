# Accountant Multi-Client Feature — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Priority 7, items #28 and #38

---

## Overview

Add a free accountant account type to Relentify. Accountants get a dedicated portal showing all their clients' health data. They can enter any client's account and operate with full permissions (limited by the client's tier). A referral commission of 10% of the client's 22accounting subscription is paid to the accountant who originally signed them up, for 36 months.

---

## User Experience

### Accountant Signup

The existing `/auth/register` page gains an "I'm an accountant signing up to manage clients" toggle. When selected:
- "Business name" field is relabelled to "Practice or firm name" and made optional (sole practitioners may not have a firm name)
- Business structure dropdown (sole trader / company) is hidden — not relevant for accountants
- VAT / company number fields are hidden
- No entity is created on signup
- `subscription_plan` is set to `'accountant'`
- The value entered in "Practice or firm name" is stored in `users.business_name` — same column, no schema change needed
- Account is free permanently — no Stripe subscription created
- After signup, redirected to `/dashboard/accountant` (the portal)

Accountants who want their own bookkeeping must create a separate normal Relentify account.

### Accountant Portal

Landing page for all accountant-tier users. Replaces the normal dashboard for this tier.

**Client list:** One card per client showing:
- Business name and status badge (Active / Pending)
- 4 health indicators:
  - Overdue invoices (count)
  - Unreconciled bank transactions (count, using `status = 'unmatched'`)
  - Missing receipts on bills/expenses (count)
  - Unfiled VAT return (flag, only if client is VAT registered)
- App access icons (accounting always shown; inventory/reminders/crm greyed if not granted by client)
- "Enter account" button (disabled for pending)

**Actions:**
- "Invite a client" button — enter email, sends invite email with referral link
- Cancel pending invite
- View earnings summary

**Earnings panel:**
- Per referred client: their current plan, monthly amount, commission rate (10%), months remaining of 36
- Running total pending payout and total paid to date

**Settings tab:**
- Bank name, sort code (format: `XX-XX-XX`), account number, account name for commission payouts

### Entering a Client's Account

Clicking "Enter account" calls `POST /api/accountant/clients/[clientId]/access`. This sets a second cookie (`relentify_client_token`, 8-hour expiry, `SameSite=Lax`, domain `.relentify.com`) and redirects to `/dashboard`. The app loads exactly as the client would see it.

A persistent banner at the top of every page (client component) reads:
**"Viewing [Client Business Name]'s account"** with an **[Exit]** button.

The [Exit] button is a client component that calls `POST /api/accountant/exit` via fetch, then redirects to `/dashboard/accountant` on success.

If the 8-hour `relentify_client_token` expires mid-session, the next request will fall back to the accountant's own `relentify_token` and middleware will redirect them to `/dashboard/accountant` with a query param `?reason=session_expired`, where a toast message explains what happened.

The accountant can perform all actions the client's tier permits. If the client's plan is `invoicing`, the accountant sees the `invoicing` tier experience — this is correct and not an error condition.

### Exiting a Client's Account

`POST /api/accountant/exit` clears `relentify_client_token` (sets cookie with empty value and `Max-Age=0`) and redirects to `/dashboard/accountant`.

### Client Side — Inviting an Accountant

Settings → Accountant tab (the existing tab is broken and is fully replaced by this feature):
- Enter accountant's email → POST `/api/settings/accountant/invite`
- If accountant already has a Relentify account with `subscription_plan = 'accountant'`: they see a pending invite in their portal and accept via `POST /api/accountant/accept?token=<invite_token>`
- If not: they receive an email inviting them to sign up as an accountant first, then the invite is accepted once they do

Once connected, the client sees their accountant's name + connection date + status. They can:
- Toggle app access per app (accounting always on and cannot be toggled off; inventory/reminders/crm default off)
- Revoke access → sets `accountant_clients.status = 'revoked'`

Revoking does not affect commission — the referring accountant continues to earn for the full 36 months from `referral_started_at` regardless of `accountant_clients.status`.

### Switching Accountants

A client can revoke their current accountant and invite a new one. Commission always belongs to `users.referred_by_accountant_id`, which is set once at signup via a referral link and never changed.

**Re-invite path (upsert):** When an accountant re-invites a previously revoked client (same `accountant_user_id` + `invited_email`), the implementation UPSERTs the existing row: `UPDATE accountant_clients SET status = 'pending', invite_token = <new>, invited_at = NOW() WHERE accountant_user_id = ? AND invited_email = ?`. No new row is created. This avoids the partial unique index conflict and keeps the history clean.

### Referral Link Flow

When an accountant invites a client who does not yet have a Relentify account, the invite email contains:
`https://accounts.relentify.com/auth/register?ref=<invite_token>`

1. The `ref` param is stored in a cookie during the signup flow
2. On account creation (inside the `POST /api/auth/register` handler, atomically with the user INSERT): `referred_by_accountant_id` and `referred_via_token` are set on the user record; the matching `accountant_clients` row is found by `invite_token = ref_param` and its `client_user_id` is backfilled with the new user's id
3. If no matching `accountant_clients` row exists for the token (e.g. token expired or never existed), the signup proceeds normally with no referral set — no error
4. On first subscription payment: `referral_started_at = NOW()`, `referral_expires_at = NOW() + interval '36 months'` are set on the user record and `accountant_clients.status` → `active`

**No commission if already a Relentify user:** If the client was already a Relentify user when they accepted an invite (either direction), `referred_by_accountant_id` is NOT set and no commission is generated. The accountant gets access but no commission. If the same person previously received a referral link and signed up via it, `referred_by_accountant_id` was already set at that point — no override.

**Commission rate:** Defined as `REFERRAL_COMMISSION_PCT` environment variable (default `0.10` = 10%). Changing the rate requires a deploy but avoids a hardcoded magic number.

---

## Auth Mechanism

### Two-Cookie Pattern

| Cookie | Contents | Domain | Lifetime | SameSite |
|--------|----------|--------|---------|---------|
| `relentify_token` | `{ userId, actorId, email, fullName, subscriptionPlan, userType }` | `.relentify.com` | 7 days | Lax |
| `relentify_client_token` | `{ userId: client.id, actorId: accountant.id, email, fullName, subscriptionPlan: client's plan, isAccountantAccess: true }` | `.relentify.com` | 8 hours | Lax |

Note: `relentify_token` already uses domain `.relentify.com` in the existing `setAuthCookie()` implementation — no change needed there.

**`JWTPayload` interface — changes to `src/lib/auth.ts`:**
```typescript
export interface JWTPayload {
  userId: string;
  actorId: string;
  email: string;
  userType: string;
  fullName: string;
  subscriptionPlan?: string;       // ADD: encoded at login, used by middleware for accountant redirect
  isAccountantAccess?: boolean;    // ADD: true only in relentify_client_token, used by checkPermission()
  workspacePermissions?: WorkspacePermissions;
}
```

**`getAuthUser()` — changes to `src/lib/auth.ts`:**
Update to check `relentify_client_token` cookie first. If present and JWT verifies successfully, return that payload. If absent, expired, or invalid, fall back to `relentify_token` as today. No DB call — pure JWT verify only. The validity of the accountant-client relationship is enforced at token issuance time.

```typescript
export async function getAuthUser(request: NextRequest): Promise<JWTPayload | null> {
  const clientToken = request.cookies.get('relentify_client_token')?.value
  if (clientToken) {
    try {
      return jwt.verify(clientToken, process.env.JWT_SECRET!) as JWTPayload
    } catch {
      // expired or invalid — fall through to primary token
    }
  }
  const token = request.cookies.get('relentify_token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
  } catch {
    return null
  }
}
```

**Middleware — changes to `middleware.ts`:**
After verifying the token, add accountant redirect logic:
- If `payload.subscriptionPlan === 'accountant'` AND `relentify_client_token` is absent → redirect non-portal routes to `/dashboard/accountant`
- If `payload.subscriptionPlan !== 'accountant'` AND route starts with `/dashboard/accountant` → redirect to `/dashboard`
Cast `verifyAuthToken()` result to `JWTPayload` to access `subscriptionPlan`.

**`checkPermission()` — changes to `src/lib/workspace-auth.ts`:**
Add accountant allow-all case before the existing workspace permission check:
```typescript
export function checkPermission(auth: JWTPayload, module: string, action: string) {
  if (auth.actorId === auth.userId) return null           // owner — always allowed (existing)
  if (auth.isAccountantAccess === true) return null       // ADD: accountant impersonation — always allowed
  // ... existing workspace permission check
}
```

### Cross-App Access

`relentify_client_token` is set on domain `.relentify.com`. Each app reads the same cookie. Each app's middleware checks:
1. Is `relentify_client_token` present and valid?
2. Is the `accountant_clients` row for `(actorId, userId)` still `active`? (DB check in middleware only)
3. Does `allowed_apps` for this app evaluate to `true`?

If check 3 fails: redirect to `https://accounting.relentify.com/dashboard/accountant?reason=app_not_granted`. **This spec implements the check in 22accounting only.** Other apps follow the same pattern when they are extended.

---

## Data Model

### Migration 022

```sql
-- ============================================================
-- 022_accountant_multi_client.sql
-- ============================================================

-- 1. Remove old incomplete accountant implementation
DROP TABLE IF EXISTS accountant_invitations;

ALTER TABLE users
  DROP COLUMN IF EXISTS accountant_user_id;

-- 2. Extend users table
ALTER TABLE users
  -- Accountant payout bank details
  ADD COLUMN accountant_bank_name VARCHAR(255),
  ADD COLUMN accountant_sort_code VARCHAR(8),       -- format: XX-XX-XX
  ADD COLUMN accountant_account_number VARCHAR(10),
  ADD COLUMN accountant_account_name VARCHAR(255),
  -- Referral tracking (set once at signup via referral link, never changed)
  ADD COLUMN referred_by_accountant_id UUID REFERENCES users(id),
  ADD COLUMN referred_via_token VARCHAR(255),
  ADD COLUMN referral_started_at TIMESTAMPTZ,       -- set on first subscription payment
  ADD COLUMN referral_expires_at TIMESTAMPTZ;       -- referral_started_at + 36 months

-- 3. Add actor_id to audit_log for accountant attribution
--    Note: table is named audit_log (singular) per migration 006
ALTER TABLE audit_log
  ADD COLUMN actor_id UUID REFERENCES users(id);   -- NULL = action by the account owner themselves

-- 4. Accountant <-> client access relationships
CREATE TABLE accountant_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL until accepted
  invited_email VARCHAR(255) NOT NULL,
  invited_by VARCHAR(20) NOT NULL CHECK (invited_by IN ('accountant', 'client')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token VARCHAR(255) UNIQUE,
  allowed_apps JSONB NOT NULL
    DEFAULT '{"accounting": true, "inventory": false, "reminders": false, "crm": false}',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Note: no UNIQUE(accountant_user_id, invited_email) — partial index below handles this
);

-- Prevent two active relationships for the same client (one accountant at a time)
CREATE UNIQUE INDEX idx_accountant_clients_one_active
  ON accountant_clients(client_user_id)
  WHERE status = 'active';

-- Prevent a new pending invite if one already exists for the same pair
-- (allows re-invite after revocation by only constraining pending/active)
CREATE UNIQUE INDEX idx_accountant_clients_active_pending
  ON accountant_clients(accountant_user_id, invited_email)
  WHERE status IN ('pending', 'active');

-- 5. Referral commission earnings (one row per subscription invoice)
CREATE TABLE accountant_referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id UUID NOT NULL REFERENCES users(id),
  client_user_id UUID NOT NULL REFERENCES users(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,  -- prevents double-processing
  client_subscription_amount INTEGER NOT NULL,  -- pence (22accounting sub only)
  commission_amount INTEGER NOT NULL,           -- FLOOR(amount * REFERRAL_COMMISSION_PCT)
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_accountant_clients_accountant ON accountant_clients(accountant_user_id);
CREATE INDEX idx_accountant_clients_client ON accountant_clients(client_user_id);
CREATE INDEX idx_accountant_clients_token ON accountant_clients(invite_token);
CREATE INDEX idx_referral_earnings_accountant ON accountant_referral_earnings(accountant_user_id);
CREATE INDEX idx_referral_earnings_client ON accountant_referral_earnings(client_user_id);
CREATE INDEX idx_users_referred_by ON users(referred_by_accountant_id);
```

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/accountant/clients` | List all clients with health data |
| POST | `/api/accountant/clients/invite` | Accountant invites a client by email |
| DELETE | `/api/accountant/clients/[clientId]` | Revoke own access or cancel invite |
| POST | `/api/accountant/clients/[clientId]/access` | Issue `relentify_client_token`, enter client account |
| POST | `/api/accountant/exit` | Clear `relentify_client_token`, return to portal |
| GET | `/api/accountant/earnings` | List referral earnings with summary |
| PATCH | `/api/accountant/settings` | Update bank payout details |
| POST | `/api/accountant/accept` | Accountant accepts a client's invite (body: `{ token: string }`) |
| GET | `/api/settings/accountant` | Client: get connected accountant + app toggles |
| POST | `/api/settings/accountant/invite` | Client invites accountant by email |
| PATCH | `/api/settings/accountant/[id]` | Client updates `allowed_apps` toggles |
| DELETE | `/api/settings/accountant/[id]` | Client revokes accountant access |
| POST | `/api/settings/accountant/accept` | Client accepts accountant's invite (body: `{ token: string }`) |

**Removed:** The existing `/api/accountant/invite` route (operated on the old `accountant_invitations` table) is deleted as part of this feature.

**Accept route payload:** Both accept routes receive `{ token: string }` where `token` is the `invite_token` from the email link. The route validates: token exists, token belongs to the authenticated user's email, status is `'pending'`.

**Validation — accountant invite validation:** `POST /api/settings/accountant/invite` must check that the invited email belongs to a user with `subscription_plan = 'accountant'`. If not found or wrong plan, return a user-friendly error: "This email isn't registered as an accountant on Relentify."

---

## Commission Processing

The Stripe webhook handler at `/api/webhooks/stripe/route.ts` is extended to handle `invoice.payment_succeeded`.

**To avoid processing Connect account invoices** (i.e. a client's customer paying their invoice), filter by checking `invoice.subscription` is not null AND the Stripe customer matches a `users.stripe_customer_id` (not a Stripe Connect account). The subscription's `price_id` must match one of the known Relentify accounting plan price IDs (from env vars: `STRIPE_PRICE_INVOICING`, `STRIPE_PRICE_SOLE_TRADER`, `STRIPE_PRICE_SMALL_BUSINESS`, `STRIPE_PRICE_MEDIUM_BUSINESS`, `STRIPE_PRICE_CORPORATE`). If the invoice has multiple line items, only sum the line items whose `price_id` matches these values.

**Processing steps** (wrapped in a single DB transaction):
1. Look up `users` record by `stripe_customer_id`
2. Check `referred_by_accountant_id IS NOT NULL` AND `(referral_expires_at IS NULL OR referral_expires_at > NOW())` — NULL means first payment not yet received; non-null in-future means window still open
3. Skip if no referral applies
4. Sum the matched accounting subscription line items (pence)
5. Calculate `commission_amount = Math.floor(amount * parseFloat(process.env.REFERRAL_COMMISSION_PCT ?? '0.10'))`
6. If `referral_started_at IS NULL`: set `referral_started_at = NOW()`, `referral_expires_at = NOW() + interval '36 months'` on the user record
7. INSERT `accountant_referral_earnings` row with `stripe_invoice_id` (UNIQUE constraint prevents duplicate processing even under Stripe retry)

**Edge cases:**
- **NULL `referral_expires_at`:** Client has a referral but has never subscribed. No commission until first payment triggers step 6. A client who cancels before ever paying generates no commission — `referral_started_at` and `referral_expires_at` remain NULL indefinitely.
- **Client cancels and re-subscribes within 36 months:** `referral_expires_at` is still in the future. Earnings resume on re-subscribe. The accountant earns for fewer than 36 calendar months of actual payments (months without payment are simply skipped) — this is an accepted trade-off.
- **Client re-subscribes after 36 months:** `referral_expires_at` is in the past. Step 2 check fails. No further commission. The original accountant does not get a new 36-month window.
- **Race condition (Stripe retries same invoice):** The `stripe_invoice_id UNIQUE` constraint causes the second INSERT to fail. The timestamp UPDATE in step 6 may fire twice but is idempotent (same values). The full block runs in a transaction so a partial second execution is rolled back.

---

## Health Data Queries (Accountant Portal)

All four indicators are fetched in a single API call (`GET /api/accountant/clients`) using a per-client batch query to avoid N+1. Each indicator is scoped to all entities owned by the client (`entities WHERE user_id = client`).

| Indicator | Query Logic |
|-----------|------------|
| Overdue invoices | `COUNT(*) FROM invoices WHERE user_id = client AND status = 'overdue'` |
| Unreconciled transactions | `COUNT(*) FROM bank_transactions WHERE user_id = client AND status = 'unmatched'` |
| Missing receipts | `COUNT(*) FROM bills b LEFT JOIN attachments a ON a.record_type = 'bill' AND a.record_id = b.id WHERE b.user_id = client AND a.id IS NULL` UNION `COUNT(*) FROM expenses e LEFT JOIN attachments a ON a.record_type = 'expense' AND a.record_id = e.id WHERE e.user_id = client AND a.id IS NULL` |
| Unfiled VAT | `EXISTS (SELECT 1 FROM entities WHERE user_id = client AND vat_registered = true)` AND no `vat_submissions` record with `status = 'submitted'` for the current VAT quarter |

The `record_type` values used in the `attachments` table are `'bill'` and `'expense'` (as defined in `src/lib/attachment.service.ts`).

---

## New Pages

| Page | Route | Who sees it |
|------|-------|-------------|
| Accountant portal | `/dashboard/accountant` | `subscriptionPlan = 'accountant'` only |
| Accountant settings | `/dashboard/accountant/settings` | Accountant only |

**Middleware redirects:**
- Accountant-tier user visiting any `/dashboard/*` route that is NOT `/dashboard/accountant*` → redirect to `/dashboard/accountant`
- Non-accountant user visiting `/dashboard/accountant*` → redirect to `/dashboard`

Since accountants have no entities, any route that calls `getActiveEntity(auth.userId)` on a bare accountant JWT (not the client token) would return null. The middleware redirect to `/dashboard/accountant` prevents this in normal use. No additional null-entity guard is needed in individual routes, but `getActiveEntity()` must return null gracefully (no throw) when no entity exists for the user.

The "viewing client" banner is a client component (`AccountantBanner`) rendered in the root `layout.tsx` server component by reading the `relentify_client_token` cookie via `cookies()`. It renders only when the cookie is present and contains a valid client name (passed from server to client as a prop).

---

## Services

| File | Purpose |
|------|---------|
| `src/lib/services/accountant.service.ts` | `getClientsWithHealth()`, `inviteClient()`, `acceptInvite(token, authenticatedUserId)`, `revokeAccess()`, `issueClientToken()`, `getEarnings()` |
| `src/lib/services/accountant_referral.service.ts` | `processReferralEarning(stripeInvoice)`, `getEarningsSummary(accountantUserId)`, `markAsPaid(earningId)` |

---

## Audit Trail Attribution

Migration 022 adds `actor_id` to `audit_log` (singular — the actual table name from migration 006). The `logAudit()` function in `src/lib/services/audit.service.ts` is updated — both the signature and the INSERT statement:
```typescript
logAudit(userId: string, action: string, entityType: string, entityId?: string, metadata?: object, actorId?: string)
```
When `actorId` is provided and differs from `userId`, it is stored in the new `actor_id` column.

All API routes that call `logAudit()` pass `auth.actorId` as the final argument. When an accountant is operating (client token active), `auth.actorId` is the accountant's id and `auth.userId` is the client's id.

The audit log display page shows:
- `actor_id IS NULL` or `actor_id = user_id`: *"Posted by You"*
- `actor_id` is a workspace member: *"Posted by [Full Name] (Team Member)"*
- `actor_id` is an accountant (`subscription_plan = 'accountant'`): *"Posted by [Full Name] (Accountant)"*

---

## Out of Scope

- Multi-accountant access per client simultaneously (one active accountant at a time, enforced by partial unique index)
- Automated bank payouts (manual payout process — Relentify staff mark earnings as `paid` after transferring)
- Extending accountant access to 23inventory, 24reminders, 25crm (cookie + DB table designed for it; implementation deferred to those app teams)
- Consolidated reporting across clients (item #38, separate feature that depends on this one)
