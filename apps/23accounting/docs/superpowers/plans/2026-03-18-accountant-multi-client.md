# Accountant Multi-Client Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "accountant" user tier that gets a dedicated portal showing all their clients' health stats, with full write access inside each client's account, plus a 10% referral commission on client subscriptions for 36 months.

**Architecture:** Two-cookie JWT impersonation — `relentify_token` (accountant's own identity) + `relentify_client_token` (client impersonation, 8h). `getAuthUser()` transparently returns client context when the client cookie is set, so zero existing routes change. Commission is tracked via `referred_by_accountant_id` on the user row (set at signup/invite-accept, never changes) so accountants earn even after access is revoked.

**Tech Stack:** Next.js 15 App Router, Postgres (raw pg queries), jsonwebtoken, Resend email, Stripe webhooks, pnpm monorepo

---

## File Map

**New files to create:**
- `database/migrations/022_accountant_multi_client.sql`
- `src/lib/accountant.service.ts`
- `src/lib/accountant_referral.service.ts`
- `src/components/AccountantBanner.tsx`
- `app/api/accountant/invite/route.ts` ← replaces the broken old one
- `app/api/accountant/invite/accept/route.ts`
- `app/api/accountant/clients/route.ts`
- `app/api/accountant/clients/[id]/route.ts`
- `app/api/accountant/switch/route.ts`
- `app/api/accountant/bank-details/route.ts`
- `app/api/accountant/earnings/route.ts`
- `app/api/settings/accountant/route.ts`
- `app/dashboard/accountant/page.tsx`
- `app/dashboard/accountant/settings/page.tsx`

**Files to modify:**
- `database/migrations/` → run new migration
- `src/lib/auth.ts` → JWTPayload additions + two-cookie getAuthUser + client cookie helpers
- `src/lib/workspace-auth.ts` → isAccountantAccess branch in checkPermission
- `middleware.ts` → accountant portal redirect logic
- `src/lib/audit.service.ts` → actorId parameter
- `src/lib/user.service.ts` → USER_COLS add referral/bank fields
- `src/lib/email.ts` → add accountant invite email function
- `app/api/webhooks/stripe/route.ts` → invoice.payment_succeeded handler
- `app/dashboard/layout.tsx` → add AccountantBanner
- `apps/21auth/src/app/register/page.tsx` → accountant toggle + ref param handling
- `apps/21auth/src/app/api/auth/register/route.ts` → accountant tier + referral backfill

**Files to delete:**
- `app/api/accountant/invite/route.ts` (old broken version — delete first, then recreate)

---

## Task 1: Database Migration 022

**Files:**
- Create: `database/migrations/022_accountant_multi_client.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 022_accountant_multi_client.sql

-- Drop old broken invite table (unused, referenced nowhere in working code)
DROP TABLE IF EXISTS accountant_invitations;

-- Remove old accountant_user_id column if present (was a different design)
ALTER TABLE users DROP COLUMN IF EXISTS accountant_user_id;

-- Add accountant-specific columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_accountant_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referral_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS accountant_sort_code         TEXT,
  ADD COLUMN IF NOT EXISTS accountant_account_number    TEXT;

-- New accountant_clients table: tracks invite + access lifecycle
CREATE TABLE IF NOT EXISTS accountant_clients (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      UUID        REFERENCES users(id) ON DELETE CASCADE, -- NULL until accepted
  invite_token        TEXT        NOT NULL UNIQUE,
  invite_email        TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'active', 'revoked')),
  invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active accountant per client at a time
CREATE UNIQUE INDEX IF NOT EXISTS accountant_clients_one_active_per_client
  ON accountant_clients (client_user_id)
  WHERE status = 'active' AND client_user_id IS NOT NULL;

-- No duplicate pending invite from same accountant to same email
CREATE UNIQUE INDEX IF NOT EXISTS accountant_clients_no_dup_pending
  ON accountant_clients (accountant_user_id, invite_email)
  WHERE status = 'pending';

-- Referral earnings: one row per Stripe invoice (UNIQUE on stripe_invoice_id = idempotency)
CREATE TABLE IF NOT EXISTS accountant_referral_earnings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id   TEXT        NOT NULL UNIQUE,
  gross_amount        INTEGER     NOT NULL,   -- pence
  commission_amount   INTEGER     NOT NULL,   -- pence
  currency            TEXT        NOT NULL DEFAULT 'gbp',
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at             TIMESTAMPTZ,            -- set manually by Relentify staff when commission is paid out
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add actor_id to audit_log (NULL = user acted for themselves)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id);
```

- [ ] **Step 2: Run the migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify \
  < /opt/relentify-monorepo/apps/22accounting/database/migrations/022_accountant_multi_client.sql
```

Expected: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` — no errors.

- [ ] **Step 3: Verify**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d accountant_clients"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d accountant_referral_earnings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d audit_log" | grep actor_id
```

- [ ] **Step 4: Commit**

```bash
cd /opt/relentify-monorepo
git add apps/22accounting/database/migrations/022_accountant_multi_client.sql
git commit -m "feat: migration 022 - accountant_clients, referral_earnings, audit actor_id"
```

---

## Task 2: Update `src/lib/auth.ts`

**Files:**
- Modify: `apps/22accounting/src/lib/auth.ts`

Add `subscriptionPlan` and `isAccountantAccess` to `JWTPayload`, update `getAuthUser()` to check `relentify_client_token` first, add `setClientCookie` and `clearClientCookie` helpers.

- [ ] **Step 1: Update the file**

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const COOKIE_NAME = 'relentify_token';
const CLIENT_COOKIE_NAME = 'relentify_client_token';

export interface WorkspacePermissions {
  invoices:  { view: boolean; create: boolean; delete: boolean };
  bills:     { view: boolean; create: boolean; delete: boolean };
  banking:   { view: boolean; reconcile: boolean };
  reports:   { view: boolean };
  settings:  { view: boolean };
  customers: { view: boolean; manage: boolean };
}

export interface JWTPayload {
  userId: string;
  actorId: string;
  email: string;
  userType: string;
  fullName: string;
  workspacePermissions?: WorkspacePermissions;
  subscriptionPlan?: string;
  isAccountantAccess?: boolean;
}

export function isWorkspaceMember(auth: JWTPayload): boolean {
  return auth.actorId !== auth.userId;
}

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function comparePassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
export function generateToken(payload: JWTPayload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (!payload.actorId) payload.actorId = payload.userId;
    return payload;
  } catch { return null; }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  // Check client impersonation token first (accountant viewing a client's account)
  const clientToken = cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (clientToken) {
    const clientPayload = verifyToken(clientToken);
    if (clientPayload) return clientPayload;
    // Expired client token — fall through to own token
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(token: string) {
  return { 'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${7*24*60*60}` };
}
export function clearAuthCookie() {
  return { 'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0` };
}
export function setClientCookie(token: string) {
  return { 'Set-Cookie': `${CLIENT_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${8*60*60}` };
}
export function clearClientCookie() {
  return { 'Set-Cookie': `${CLIENT_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0` };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/auth.ts
git commit -m "feat: add isAccountantAccess to JWTPayload, two-cookie getAuthUser, client cookie helpers"
```

---

## Task 3: Update `src/lib/workspace-auth.ts`

**Files:**
- Modify: `apps/22accounting/src/lib/workspace-auth.ts`

Add the `isAccountantAccess` branch — accountants get full access, same as owners.

- [ ] **Step 1: Update the file**

```typescript
import { JWTPayload, WorkspacePermissions } from './auth';
import { NextResponse } from 'next/server';

type Module = keyof WorkspacePermissions;

export function checkPermission(
  auth: JWTPayload,
  module: Module,
  action: string
): NextResponse | null {
  if (auth.actorId === auth.userId) return null;           // owner, always allowed
  if (auth.isAccountantAccess === true) return null;       // accountant, full access
  const allowed = (auth.workspacePermissions as unknown as Record<string, Record<string, boolean>>)?.[module]?.[action];
  if (!allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/workspace-auth.ts
git commit -m "feat: accountant access bypasses workspace permission checks"
```

---

## Task 4: Update `middleware.ts`

**Files:**
- Modify: `apps/22accounting/middleware.ts`

Add two routing rules:
1. Accountant without a client cookie accessing `/dashboard/` (non-accountant routes) → redirect to `/dashboard/accountant`
2. Non-accountant accessing `/dashboard/accountant` routes → redirect to `/dashboard`

- [ ] **Step 1: Update the middleware**

Replace the auth section (lines 94–105) with:

```typescript
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(getPublicUrl(req))))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')

  if (!payload) {
    return NextResponse.redirect(new URL(getRedirectUrl(getPublicUrl(req))))
  }

  const isAccountant = payload.userType === 'accountant'
  const hasClientToken = !!req.cookies.get('relentify_client_token')?.value

  // Accountant with no active client → must stay in accountant portal
  if (isAccountant && !hasClientToken && pathname.startsWith('/dashboard/') && !pathname.startsWith('/dashboard/accountant')) {
    return NextResponse.redirect(new URL('/dashboard/accountant', getPublicUrl(req)))
  }

  // Non-accountant trying to access accountant portal → redirect to main dashboard
  if (!isAccountant && pathname.startsWith('/dashboard/accountant')) {
    return NextResponse.redirect(new URL('/dashboard', getPublicUrl(req)))
  }

  return NextResponse.next()
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/middleware.ts
git commit -m "feat: middleware redirects accountants to portal, blocks non-accountants from portal"
```

---

## Task 5: Update `src/lib/audit.service.ts`

**Files:**
- Modify: `apps/22accounting/src/lib/audit.service.ts`

Add optional `actorId` parameter so accountant actions are attributed correctly in the audit trail.

- [ ] **Step 1: Update the function signature and INSERT**

Read the current file first, then replace `logAudit` with:

```typescript
export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  actorId?: string
) {
  await query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, entityType, entityId || null,
     metadata ? JSON.stringify(metadata) : null,
     actorId || null]
  );
}
```

Note: The new `actorId` parameter is 6th and optional, so all 20 existing `logAudit()` callsites continue to work without changes.

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/audit.service.ts
git commit -m "feat: logAudit accepts optional actorId for accountant attribution"
```

---

## Task 6: Update `src/lib/user.service.ts`

**Files:**
- Modify: `apps/22accounting/src/lib/user.service.ts`

Add referral and accountant bank fields to `USER_COLS` so they're returned by `getUserById()` etc.

- [ ] **Step 1: Update USER_COLS**

Replace the `USER_COLS` constant:

```typescript
const USER_COLS = `id, email, full_name, business_name, user_type, stripe_account_id,
  stripe_account_status, business_structure, company_number, vat_registered, vat_number,
  is_active, subscription_plan as tier, subscription_status, trial_ends_at, created_at,
  stripe_customer_id, COALESCE(accept_card_payments, true) as accept_card_payments,
  COALESCE(payment_reminders_enabled, false) as payment_reminders_enabled,
  active_entity_id,
  referred_by_accountant_id, referral_started_at, referral_expires_at,
  accountant_bank_account_name, accountant_sort_code, accountant_account_number`;
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/user.service.ts
git commit -m "feat: USER_COLS includes referral and accountant bank detail fields"
```

---

## Task 7: Create `src/lib/accountant.service.ts`

**Files:**
- Create: `apps/22accounting/src/lib/accountant.service.ts`

Core service for invite/accept/revoke/list and health stats query.

- [ ] **Step 1: Create the file**

```typescript
import { query } from './db';
import crypto from 'crypto';

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteClient(accountantUserId: string, inviteEmail: string) {
  const token = crypto.randomBytes(32).toString('hex');
  // Upsert: if pending invite exists for this accountant+email, refresh the token
  const r = await query(
    `INSERT INTO accountant_clients (accountant_user_id, invite_email, invite_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (accountant_user_id, invite_email) WHERE status = 'pending'
     DO UPDATE SET invite_token = EXCLUDED.invite_token, invited_at = NOW()
     RETURNING *`,
    [accountantUserId, inviteEmail.toLowerCase().trim(), token]
  );
  return r.rows[0];
}

export async function getInviteByToken(token: string) {
  const r = await query(
    `SELECT ac.*, u.full_name as accountant_name, u.business_name as accountant_firm
     FROM accountant_clients ac
     JOIN users u ON u.id = ac.accountant_user_id
     WHERE ac.invite_token = $1`,
    [token]
  );
  return r.rows[0] || null;
}

// ── Accept (existing client accepts accountant invite) ────────────────────────

export async function acceptInvite(token: string, clientUserId: string) {
  // Check if client already has an active accountant
  const existing = await query(
    `SELECT id FROM accountant_clients WHERE client_user_id = $1 AND status = 'active'`,
    [clientUserId]
  );
  if (existing.rows.length > 0) throw new Error('CLIENT_HAS_ACCOUNTANT');

  const r = await query(
    `UPDATE accountant_clients
     SET status = 'active', client_user_id = $1, accepted_at = NOW()
     WHERE invite_token = $2 AND status = 'pending'
     RETURNING *`,
    [clientUserId, token]
  );
  if (!r.rows[0]) throw new Error('INVALID_TOKEN');

  const invite = r.rows[0];

  // Set referral attribution (only if not already attributed)
  await query(
    `UPDATE users SET
       referred_by_accountant_id = COALESCE(referred_by_accountant_id, $1),
       referral_started_at       = COALESCE(referral_started_at, NOW()),
       referral_expires_at       = COALESCE(referral_expires_at, NOW() + INTERVAL '36 months')
     WHERE id = $2`,
    [invite.accountant_user_id, clientUserId]
  );

  return invite;
}

// ── Revoke access (either party) ──────────────────────────────────────────────

export async function revokeAccess(accountantUserId: string, clientUserId: string) {
  await query(
    `UPDATE accountant_clients SET status = 'revoked', revoked_at = NOW()
     WHERE accountant_user_id = $1 AND client_user_id = $2 AND status = 'active'`,
    [accountantUserId, clientUserId]
  );
}

export async function revokeAccessByClient(clientUserId: string) {
  await query(
    `UPDATE accountant_clients SET status = 'revoked', revoked_at = NOW()
     WHERE client_user_id = $1 AND status = 'active'`,
    [clientUserId]
  );
}

// ── List clients for accountant portal ───────────────────────────────────────

export async function getAccountantClients(accountantUserId: string) {
  const r = await query(
    `SELECT
       ac.id, ac.client_user_id, ac.invite_email, ac.status,
       ac.invited_at, ac.accepted_at,
       u.full_name, u.email, u.business_name, u.subscription_plan as tier,
       u.active_entity_id
     FROM accountant_clients ac
     LEFT JOIN users u ON u.id = ac.client_user_id
     WHERE ac.accountant_user_id = $1 AND ac.status IN ('pending', 'active')
     ORDER BY ac.created_at DESC`,
    [accountantUserId]
  );
  return r.rows;
}

export async function getActiveClientForAccountant(accountantUserId: string, clientUserId: string) {
  const r = await query(
    `SELECT ac.* FROM accountant_clients ac
     WHERE ac.accountant_user_id = $1 AND ac.client_user_id = $2 AND ac.status = 'active'`,
    [accountantUserId, clientUserId]
  );
  return r.rows[0] || null;
}

// ── Client health stats for accountant dashboard ──────────────────────────────

export async function getClientHealthStats(clientUserIds: string[]) {
  if (clientUserIds.length === 0) return {};

  const placeholders = clientUserIds.map((_, i) => `$${i + 1}`).join(', ');

  // Overdue invoices
  const overdueR = await query(
    `SELECT user_id, COUNT(*) as count
     FROM invoices
     WHERE user_id IN (${placeholders}) AND status = 'overdue'
     GROUP BY user_id`,
    clientUserIds
  );

  // Unmatched bank transactions
  const unmatchedR = await query(
    `SELECT user_id, COUNT(*) as count
     FROM bank_transactions
     WHERE user_id IN (${placeholders}) AND status = 'unmatched'
     GROUP BY user_id`,
    clientUserIds
  );

  // Bills without any attachment (missing receipts)
  const missingR = await query(
    `SELECT b.user_id, COUNT(*) as count
     FROM bills b
     LEFT JOIN attachments a ON a.record_type = 'bill' AND a.record_id = b.id::text
     WHERE b.user_id IN (${placeholders}) AND a.id IS NULL AND b.status != 'paid'
     GROUP BY b.user_id`,
    clientUserIds
  );

  // Build map keyed by user_id
  const stats: Record<string, { overdueInvoices: number; unmatchedTransactions: number; missingReceipts: number }> = {};
  for (const id of clientUserIds) {
    stats[id] = { overdueInvoices: 0, unmatchedTransactions: 0, missingReceipts: 0 };
  }
  for (const row of overdueR.rows)   stats[row.user_id].overdueInvoices       = parseInt(row.count);
  for (const row of unmatchedR.rows) stats[row.user_id].unmatchedTransactions = parseInt(row.count);
  for (const row of missingR.rows)   stats[row.user_id].missingReceipts       = parseInt(row.count);

  return stats;
}

// ── Settings: get accountant for a client (for client-side settings page) ────

export async function getClientAccountant(clientUserId: string) {
  const r = await query(
    `SELECT ac.id, ac.accountant_user_id, ac.status, ac.accepted_at,
            u.full_name as accountant_name, u.email as accountant_email, u.business_name as accountant_firm
     FROM accountant_clients ac
     JOIN users u ON u.id = ac.accountant_user_id
     WHERE ac.client_user_id = $1 AND ac.status = 'active'`,
    [clientUserId]
  );
  return r.rows[0] || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/accountant.service.ts
git commit -m "feat: accountant.service - invite/accept/revoke/list/health stats"
```

---

## Task 8: Create `src/lib/accountant_referral.service.ts`

**Files:**
- Create: `apps/22accounting/src/lib/accountant_referral.service.ts`

Records a referral earning when a referred client pays a Stripe invoice. Idempotent via `stripe_invoice_id` UNIQUE constraint.

- [ ] **Step 1: Create the file**

```typescript
import { query } from './db';

const KNOWN_PLAN_PRICE_IDS = [
  process.env.STRIPE_PRICE_ID_INVOICING,
  process.env.STRIPE_PRICE_ID_SOLE_TRADER,
  process.env.STRIPE_PRICE_ID_SMALL_BUSINESS,
  process.env.STRIPE_PRICE_ID_MEDIUM_BUSINESS,
  process.env.STRIPE_PRICE_ID_CORPORATE,
].filter(Boolean);

export function isSubscriptionInvoice(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return KNOWN_PLAN_PRICE_IDS.includes(priceId);
}

export async function recordReferralEarning(params: {
  stripeInvoiceId: string;
  clientUserId: string;
  grossAmount: number; // pence
  currency: string;
}) {
  // Look up referral attribution for the client
  const r = await query(
    `SELECT referred_by_accountant_id, referral_expires_at
     FROM users WHERE id = $1`,
    [params.clientUserId]
  );
  const user = r.rows[0];
  if (!user?.referred_by_accountant_id) return null; // not a referred client

  // Check 36-month window (NULL means no expiry set yet — treat as valid)
  if (user.referral_expires_at && new Date(user.referral_expires_at) < new Date()) return null;

  const commission = Math.floor(params.grossAmount * parseFloat(process.env.REFERRAL_COMMISSION_PCT ?? '0.10'));

  // Insert with ON CONFLICT DO NOTHING for idempotency (webhook may retry)
  const result = await query(
    `INSERT INTO accountant_referral_earnings
       (accountant_user_id, client_user_id, stripe_invoice_id, gross_amount, commission_amount, currency)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (stripe_invoice_id) DO NOTHING
     RETURNING *`,
    [user.referred_by_accountant_id, params.clientUserId,
     params.stripeInvoiceId, params.grossAmount, commission, params.currency]
  );
  return result.rows[0] ?? null;
}

export async function getEarningsForAccountant(accountantUserId: string) {
  const r = await query(
    `SELECT
       are.*,
       u.full_name as client_name, u.business_name as client_business,
       u.email as client_email
     FROM accountant_referral_earnings are
     JOIN users u ON u.id = are.client_user_id
     WHERE are.accountant_user_id = $1
     ORDER BY are.created_at DESC`,
    [accountantUserId]
  );
  return r.rows;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/accountant_referral.service.ts
git commit -m "feat: accountant_referral.service - record and list referral earnings"
```

---

## Task 9: Add accountant emails to `src/lib/email.ts`

**Files:**
- Modify: `apps/22accounting/src/lib/email.ts`

Add two functions: `sendAccountantInviteToClient` and `sendClientInviteToAccountant`.

- [ ] **Step 1: Append the two email functions to the end of `src/lib/email.ts`**

```typescript
// ── Accountant invites client to sign up ──────────────────────────────────────

export async function sendAccountantInviteToClient(params: {
  to: string;
  accountantName: string;
  accountantFirm?: string;
  inviteToken: string;
}) {
  const { to, accountantName, accountantFirm, inviteToken } = params;
  const signupUrl = `https://accounts.relentify.com/register?ref=${inviteToken}`;
  const senderLabel = accountantFirm ? `${accountantName} (${accountantFirm})` : accountantName;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${senderLabel} has invited you to Relentify Accounting`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">You've been invited to Relentify</h2>
          <p>Hi,</p>
          <p><strong>${senderLabel}</strong> has invited you to use Relentify Accounting and has requested access to help manage your accounts.</p>
          <p>Click the link below to create your account. ${accountantName} will automatically be connected as your accountant once you sign up.</p>
          <p style="margin: 32px 0;">
            <a href="${signupUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Create Account</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you did not expect this invitation, you can ignore this email.</p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    return { success: false };
  }
}

// ── Client invites existing accountant ───────────────────────────────────────

export async function sendClientInviteToAccountant(params: {
  to: string;
  clientName: string;
  clientBusiness?: string;
  inviteToken: string;
}) {
  const { to, clientName, clientBusiness, inviteToken } = params;
  const acceptUrl = `https://accounts.relentify.com/dashboard/accountant?accept=${inviteToken}`;
  const senderLabel = clientBusiness ? `${clientName} (${clientBusiness})` : clientName;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Relentify <invoices@relentify.com>',
      to: [to],
      subject: `${senderLabel} has invited you as their accountant on Relentify`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="margin-top: 0;">New client invitation</h2>
          <p>Hi,</p>
          <p><strong>${senderLabel}</strong> has invited you to access their Relentify Accounting as their accountant.</p>
          <p>Accept the invitation from your Relentify accountant portal to get started.</p>
          <p style="margin: 32px 0;">
            <a href="${acceptUrl}" style="background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Accept Invitation</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you don't have a Relentify accountant account yet, <a href="https://accounts.relentify.com/register">sign up first</a>.</p>
        </div>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false }; }
    return { success: true, emailId: data?.id };
  } catch (e) {
    console.error('Email send failed:', e);
    return { success: false };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/lib/email.ts
git commit -m "feat: accountant invite email functions"
```

---

## Task 10: Delete old broken invite route

**Files:**
- Delete: `apps/22accounting/app/api/accountant/invite/route.ts` (old version)

- [ ] **Step 1: Delete the file**

```bash
rm /opt/relentify-monorepo/apps/22accounting/app/api/accountant/invite/route.ts
```

- [ ] **Step 2: Commit**

```bash
git add -u apps/22accounting/app/api/accountant/invite/route.ts
git commit -m "chore: delete old broken accountant invite route"
```

---

## Task 11: Create `app/api/accountant/invite/route.ts` (new)

**Files:**
- Create: `apps/22accounting/app/api/accountant/invite/route.ts`

Accountant sends invite to a client email. Also handles: client invites their accountant (both directions).

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { inviteClient, getInviteByToken } from '@/lib/accountant.service';
import { getUserByEmail } from '@/lib/user.service';
import { sendAccountantInviteToClient, sendClientInviteToAccountant } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, direction } = await req.json();
  // direction: 'accountant_to_client' (default) | 'client_to_accountant'

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  if (direction === 'client_to_accountant') {
    // Client invites their accountant
    // Find the accountant by email — they must already have an accountant account
    const accountant = await getUserByEmail(email);
    if (!accountant || accountant.user_type !== 'accountant') {
      return NextResponse.json({ error: 'No accountant account found with that email. Ask them to sign up as an accountant first.' }, { status: 404 });
    }
    // Create invite from the accountant's perspective (so they can accept it)
    const invite = await inviteClient(accountant.id, auth.email);
    await sendClientInviteToAccountant({
      to: email,
      clientName: auth.fullName,
      clientBusiness: undefined,
      inviteToken: invite.invite_token,
    });
    return NextResponse.json({ ok: true });
  }

  // Default: accountant invites client
  if (auth.userType !== 'accountant') {
    return NextResponse.json({ error: 'Only accountant accounts can send client invites' }, { status: 403 });
  }
  const invite = await inviteClient(auth.userId, email);

  // Get accountant info for email
  const { getUserById } = await import('@/lib/user.service');
  const accountantUser = await getUserById(auth.userId);

  await sendAccountantInviteToClient({
    to: email,
    accountantName: auth.fullName,
    accountantFirm: accountantUser?.business_name || undefined,
    inviteToken: invite.invite_token,
  });

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/invite/route.ts
git commit -m "feat: POST /api/accountant/invite - accountant invites client, client invites accountant"
```

---

## Task 12: Create `app/api/accountant/invite/accept/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/invite/accept/route.ts`

Existing client accepts an accountant's invite.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { acceptInvite, getInviteByToken } from '@/lib/accountant.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  // Validate the invite exists and is pending
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== 'pending') {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  try {
    await acceptInvite(token, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'CLIENT_HAS_ACCOUNTANT') {
      return NextResponse.json({ error: 'You already have an active accountant. Revoke their access first.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/invite/accept/route.ts
git commit -m "feat: POST /api/accountant/invite/accept - client accepts accountant invite"
```

---

## Task 13: Create `app/api/accountant/clients/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/clients/route.ts`

GET: Returns accountant's client list with health stats.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getAccountantClients, getClientHealthStats } from '@/lib/accountant.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const clients = await getAccountantClients(auth.userId);

  const activeClientIds = clients
    .filter(c => c.status === 'active' && c.client_user_id)
    .map(c => c.client_user_id as string);

  const healthStats = await getClientHealthStats(activeClientIds);

  const result = clients.map(c => ({
    ...c,
    health: c.client_user_id ? (healthStats[c.client_user_id] ?? null) : null,
  }));

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/clients/route.ts
git commit -m "feat: GET /api/accountant/clients - list clients with health stats"
```

---

## Task 14: Create `app/api/accountant/clients/[id]/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/clients/[id]/route.ts`

DELETE: Accountant revokes access to a client.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { revokeAccess } from '@/lib/accountant.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: clientUserId } = await params;

  await revokeAccess(auth.userId, clientUserId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/clients/[id]/route.ts
git commit -m "feat: DELETE /api/accountant/clients/[id] - revoke client access"
```

---

## Task 15: Create `app/api/accountant/switch/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/switch/route.ts`

POST with `{ clientUserId }` → validate active relationship → set `relentify_client_token` → redirect to `/dashboard`
DELETE → clear `relentify_client_token` → redirect to `/dashboard/accountant`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, generateToken, setClientCookie, clearClientCookie } from '@/lib/auth';
import { getActiveClientForAccountant } from '@/lib/accountant.service';
import { getUserById } from '@/lib/user.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { clientUserId } = await req.json();
  if (!clientUserId) return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });

  // Verify active accountant-client relationship
  const relationship = await getActiveClientForAccountant(auth.userId, clientUserId);
  if (!relationship) {
    return NextResponse.json({ error: 'No active relationship with this client' }, { status: 403 });
  }

  const clientUser = await getUserById(clientUserId);
  if (!clientUser) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Mint client impersonation token (8h)
  const clientToken = generateToken({
    userId: clientUserId,
    actorId: auth.userId,
    email: clientUser.email,
    userType: clientUser.user_type,
    fullName: clientUser.full_name,
    subscriptionPlan: clientUser.tier,
    isAccountantAccess: true,
  });

  const res = NextResponse.json({ ok: true });
  const cookie = setClientCookie(clientToken);
  res.headers.set('Set-Cookie', cookie['Set-Cookie']);
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const cookie = clearClientCookie();
  res.headers.set('Set-Cookie', cookie['Set-Cookie']);
  return res;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/switch/route.ts
git commit -m "feat: POST/DELETE /api/accountant/switch - enter/exit client impersonation"
```

---

## Task 16: Create `app/api/accountant/bank-details/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/bank-details/route.ts`

GET/PUT: Accountant manages their bank details for receiving commission payments.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getUserById } from '@/lib/user.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const user = await getUserById(auth.userId);
  return NextResponse.json({
    accountant_bank_account_name: user?.accountant_bank_account_name ?? null,
    accountant_sort_code: user?.accountant_sort_code ?? null,
    accountant_account_number: user?.accountant_account_number ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { accountant_bank_account_name, accountant_sort_code, accountant_account_number } = await req.json();

  await query(
    `UPDATE users SET
       accountant_bank_account_name = $1,
       accountant_sort_code = $2,
       accountant_account_number = $3
     WHERE id = $4`,
    [accountant_bank_account_name || null, accountant_sort_code || null, accountant_account_number || null, auth.userId]
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/bank-details/route.ts
git commit -m "feat: GET/PUT /api/accountant/bank-details - manage commission payment bank details"
```

---

## Task 17: Create `app/api/accountant/earnings/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/accountant/earnings/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getEarningsForAccountant } from '@/lib/accountant_referral.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const earnings = await getEarningsForAccountant(auth.userId);

  // Total
  const total = earnings.reduce((sum, e) => sum + e.commission_amount, 0);

  return NextResponse.json({ earnings, total_pence: total });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/accountant/earnings/route.ts
git commit -m "feat: GET /api/accountant/earnings - referral commission history"
```

---

## Task 18: Create `app/api/settings/accountant/route.ts`

**Files:**
- Create: `apps/22accounting/app/api/settings/accountant/route.ts`

Client-side: GET their current accountant, POST to invite an accountant, DELETE to revoke access.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getClientAccountant, revokeAccessByClient } from '@/lib/accountant.service';
import { inviteClient } from '@/lib/accountant.service';
import { getUserByEmail } from '@/lib/user.service';
import { sendClientInviteToAccountant } from '@/lib/email';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountant = await getClientAccountant(auth.userId);
  return NextResponse.json({ accountant: accountant ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { accountantEmail } = await req.json();
  if (!accountantEmail) return NextResponse.json({ error: 'accountantEmail required' }, { status: 400 });

  const accountant = await getUserByEmail(accountantEmail);
  if (!accountant || accountant.user_type !== 'accountant') {
    return NextResponse.json({ error: 'No accountant account found with that email' }, { status: 404 });
  }

  const invite = await inviteClient(accountant.id, auth.email);
  await sendClientInviteToAccountant({
    to: accountantEmail,
    clientName: auth.fullName,
    inviteToken: invite.invite_token,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await revokeAccessByClient(auth.userId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/settings/accountant/route.ts
git commit -m "feat: GET/POST/DELETE /api/settings/accountant - client manages their accountant"
```

---

## Task 19: Add `invoice.payment_succeeded` to Stripe webhook

**Files:**
- Modify: `apps/22accounting/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add the import and handler**

At the top of the file, import the referral service:

```typescript
import { recordReferralEarning, isSubscriptionInvoice } from '@/lib/accountant_referral.service';
```

Inside the `switch (event.type)` block, add:

```typescript
case 'invoice.payment_succeeded': {
  const invoice = event.data.object as Stripe.Invoice;
  const lineItems = invoice.lines?.data ?? [];
  const priceId = lineItems[0]?.price?.id;

  if (!isSubscriptionInvoice(priceId)) break; // ignore non-subscription invoices

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) break;

  const clientUser = await getUserByStripeCustomerId(customerId);
  if (!clientUser) break;

  await recordReferralEarning({
    stripeInvoiceId: invoice.id,
    clientUserId: clientUser.id,
    grossAmount: invoice.amount_paid,
    currency: invoice.currency,
  });
  break;
}
```

Note: `getUserByStripeCustomerId` is already imported/available in the existing webhook route.

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/api/webhooks/stripe/route.ts
git commit -m "feat: Stripe invoice.payment_succeeded webhook records referral commission"
```

---

## Task 20: 21auth register page — accountant toggle + ref param

**Files:**
- Modify: `apps/21auth/src/app/register/page.tsx`

Read the full file first, then add:
1. Detect `?ref=<token>` in URL params and pass it through to the API call
2. "Signing up as an accountant?" toggle
3. When toggled: show "Practice or firm name" (optional), hide business structure/VAT fields
4. Include `isAccountant: true` and `firmName: value` in the POST body when toggled

- [ ] **Step 1: Key changes to the register page**

Add near the top of the component:

```typescript
const searchParams = useSearchParams();
const refToken = searchParams.get('ref');
const [isAccountant, setIsAccountant] = useState(false);
const [firmName, setFirmName] = useState('');
```

In the form, add the accountant toggle after the existing plan/name fields:

```tsx
{/* Accountant toggle */}
<div className="flex items-center gap-3 mt-2">
  <input
    type="checkbox"
    id="isAccountant"
    checked={isAccountant}
    onChange={e => setIsAccountant(e.target.checked)}
    className="h-4 w-4"
  />
  <label htmlFor="isAccountant" className="text-sm text-[var(--theme-text-muted)]">
    I'm an accountant signing up for a practice account
  </label>
</div>

{isAccountant && (
  <div>
    <label className="text-sm font-medium text-[var(--theme-text)]">
      Practice or firm name <span className="text-[var(--theme-text-muted)]">(optional)</span>
    </label>
    <input
      type="text"
      value={firmName}
      onChange={e => setFirmName(e.target.value)}
      placeholder="e.g. Smith & Partners Accountants"
      className="mt-1 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm"
    />
  </div>
)}
```

When `isAccountant` is true, hide the business structure and VAT sections (wrap them in `{!isAccountant && (...)}`)

In the submit handler, include:

```typescript
const body = {
  email, password, fullName,
  businessName: isAccountant ? (firmName || null) : businessName,
  tier: isAccountant ? 'accountant' : selectedTier,
  isAccountant,
  referralToken: refToken || undefined,
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/21auth/src/app/register/page.tsx
git commit -m "feat: register page - accountant toggle, firm name field, ref param pass-through"
```

---

## Task 21: 21auth register API — accountant tier + referral backfill

**Files:**
- Modify: `apps/21auth/src/app/api/auth/register/route.ts`

- [ ] **Step 1: Add 'accountant' to VALID_TIERS and handle referral backfill**

Add `'accountant'` to the `VALID_TIERS` array (the tier guard).

**Critical:** The middleware checks `payload.userType === 'accountant'`, which maps to the `user_type` DB column. When `isAccountant` is true, the register INSERT must set `user_type = 'accountant'` alongside `subscription_plan = 'accountant'`. Find the INSERT statement and update the column list accordingly — something like:

```typescript
// In the INSERT, add user_type when isAccountant
const userType = isAccountant ? 'accountant' : 'client'; // or whatever the default is
await query(
  `INSERT INTO users (email, password_hash, full_name, business_name, user_type, subscription_plan)
   VALUES ($1, $2, $3, $4, $5, $6) RETURNING ...`,
  [email, hash, fullName, businessName || null, userType, tier]
);
```

After the user is created, add:

```typescript
// If user signed up via accountant referral link, accept the invite
if (referralToken && typeof referralToken === 'string') {
  try {
    // acceptInvite lives in 22accounting — call via direct DB query here
    // since 21auth is a separate app. Use the same DB connection.
    await query(
      `UPDATE accountant_clients
       SET status = 'active', client_user_id = $1, accepted_at = NOW()
       WHERE invite_token = $2 AND status = 'pending'`,
      [newUser.id, referralToken]
    );
    // Set referral attribution on user
    const inviteRow = await query(
      `SELECT accountant_user_id FROM accountant_clients WHERE invite_token = $1`,
      [referralToken]
    );
    if (inviteRow.rows[0]) {
      await query(
        `UPDATE users SET
           referred_by_accountant_id = $1,
           referral_started_at = NOW(),
           referral_expires_at = NOW() + INTERVAL '36 months'
         WHERE id = $2`,
        [inviteRow.rows[0].accountant_user_id, newUser.id]
      );
    }
  } catch (e) {
    // Non-fatal: log but don't fail registration
    console.error('Referral backfill failed:', e);
  }
}
```

Note: 21auth already uses the same Postgres DB via its own `db.ts` wrapper. The `query` function is already imported. Add `referralToken` extraction from `await req.json()`.

- [ ] **Step 2: Commit**

```bash
git add apps/21auth/src/app/api/auth/register/route.ts
git commit -m "feat: register API - accountant tier support + referral token backfill on signup"
```

---

## Task 22: Create `app/dashboard/accountant/page.tsx`

**Files:**
- Create: `apps/22accounting/app/dashboard/accountant/page.tsx`

The accountant portal: shows client list with health stat badges, "Enter Account" buttons.

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClientHealth {
  overdueInvoices: number;
  unmatchedTransactions: number;
  missingReceipts: number;
}

interface Client {
  id: string;
  client_user_id: string | null;
  invite_email: string;
  status: 'pending' | 'active';
  full_name: string | null;
  email: string | null;
  business_name: string | null;
  tier: string | null;
  health: ClientHealth | null;
}

export default function AccountantPortalPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/accountant/clients')
      .then(r => r.json())
      .then(data => { setClients(data); setLoading(false); });
  }, []);

  async function enterClient(clientUserId: string) {
    await fetch('/api/accountant/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientUserId }),
    });
    router.push('/dashboard');
  }

  async function revokeClient(clientUserId: string) {
    if (!confirm('Remove this client? They will need to invite you again to restore access.')) return;
    await fetch(`/api/accountant/clients/${clientUserId}`, { method: 'DELETE' });
    setClients(prev => prev.filter(c => c.client_user_id !== clientUserId));
  }

  // Handle ?accept=<token> — client has sent an invite to this accountant; accept it on portal load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const acceptToken = params.get('accept');
    if (!acceptToken) return;
    fetch('/api/accountant/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: acceptToken }),
    }).then(r => {
      if (r.ok) {
        // Refresh client list to show the newly accepted client
        fetch('/api/accountant/clients').then(r => r.json()).then(data => setClients(data));
        // Remove the query param from URL without reload
        window.history.replaceState({}, '', '/dashboard/accountant');
      }
    });
  }, []);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  async function sendInvite() {
    setInviting(true);
    const r = await fetch('/api/accountant/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    });
    setInviting(false);
    setInviteMsg(r.ok ? 'Invite sent!' : 'Failed to send invite');
    if (r.ok) setInviteEmail('');
  }

  if (loading) return <div className="p-8 text-[var(--theme-text-muted)]">Loading…</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--theme-text)] mb-2">Client Portal</h1>
      <p className="text-[var(--theme-text-muted)] mb-8">Manage your clients and access their accounts.</p>

      {/* Invite form */}
      <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-[var(--theme-text)] mb-3">Invite a Client</h2>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="client@example.com"
            className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm text-[var(--theme-text)]"
          />
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail}
            className="rounded-lg bg-[var(--theme-primary)] text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {inviteMsg && <p className="text-sm mt-2 text-[var(--theme-text-muted)]">{inviteMsg}</p>}
      </div>

      {/* Client list */}
      <div className="space-y-3">
        {clients.length === 0 && (
          <p className="text-[var(--theme-text-muted)] text-sm">No clients yet. Send an invite above to get started.</p>
        )}
        {clients.map(client => (
          <div key={client.id} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--theme-text)]">
                  {client.full_name ?? client.invite_email}
                </span>
                {client.business_name && (
                  <span className="text-xs text-[var(--theme-text-muted)]">· {client.business_name}</span>
                )}
                {client.status === 'pending' && (
                  <span className="text-xs bg-[var(--theme-warning)]/15 text-[var(--theme-warning)] px-2 py-0.5 rounded-full">Pending</span>
                )}
              </div>
              <p className="text-sm text-[var(--theme-text-muted)] mt-0.5">{client.email ?? client.invite_email}</p>

              {/* Health badges */}
              {client.health && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {client.health.overdueInvoices > 0 && (
                    <span className="text-xs bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] px-2 py-0.5 rounded-full">
                      {client.health.overdueInvoices} overdue invoice{client.health.overdueInvoices !== 1 ? 's' : ''}
                    </span>
                  )}
                  {client.health.unmatchedTransactions > 0 && (
                    <span className="text-xs bg-[var(--theme-warning)]/15 text-[var(--theme-warning)] px-2 py-0.5 rounded-full">
                      {client.health.unmatchedTransactions} unreconciled
                    </span>
                  )}
                  {client.health.missingReceipts > 0 && (
                    <span className="text-xs bg-[var(--theme-warning)]/15 text-[var(--theme-warning)] px-2 py-0.5 rounded-full">
                      {client.health.missingReceipts} missing receipts
                    </span>
                  )}
                  {client.health.overdueInvoices === 0 && client.health.unmatchedTransactions === 0 && client.health.missingReceipts === 0 && (
                    <span className="text-xs bg-[var(--theme-success)]/15 text-[var(--theme-success)] px-2 py-0.5 rounded-full">All clear</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {client.status === 'active' && client.client_user_id && (
                <button
                  onClick={() => enterClient(client.client_user_id!)}
                  className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-1.5 text-sm font-medium text-[var(--theme-text)] hover:bg-[var(--theme-background)]"
                >
                  Enter Account →
                </button>
              )}
              {client.status === 'active' && client.client_user_id && (
                <button
                  onClick={() => revokeClient(client.client_user_id!)}
                  className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)] px-2"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="mt-8 flex gap-4 text-sm">
        <a href="/dashboard/accountant/settings" className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]">
          Bank details & commission →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/dashboard/accountant/page.tsx
git commit -m "feat: accountant portal page - client list with health stats and enter/invite/revoke"
```

---

## Task 23: Create `app/dashboard/accountant/settings/page.tsx`

**Files:**
- Create: `apps/22accounting/app/dashboard/accountant/settings/page.tsx`

Bank details form + commission earnings table.

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface BankDetails {
  accountant_bank_account_name: string | null;
  accountant_sort_code: string | null;
  accountant_account_number: string | null;
}

interface Earning {
  id: string;
  client_name: string;
  client_business: string | null;
  gross_amount: number;
  commission_amount: number;
  currency: string;
  created_at: string;
}

export default function AccountantSettingsPage() {
  const [details, setDetails] = useState<BankDetails>({ accountant_bank_account_name: '', accountant_sort_code: '', accountant_account_number: '' });
  const [saved, setSaved] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totalPence, setTotalPence] = useState(0);

  useEffect(() => {
    fetch('/api/accountant/bank-details').then(r => r.json()).then(setDetails);
    fetch('/api/accountant/earnings').then(r => r.json()).then(d => {
      setEarnings(d.earnings ?? []);
      setTotalPence(d.total_pence ?? 0);
    });
  }, []);

  async function saveDetails() {
    await fetch('/api/accountant/bank-details', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-[var(--theme-text)] mb-1">Bank Details</h1>
        <p className="text-sm text-[var(--theme-text-muted)] mb-6">Commission payments will be made to this account manually each month.</p>

        <div className="space-y-4">
          {(['accountant_bank_account_name', 'accountant_sort_code', 'accountant_account_number'] as const).map(field => (
            <div key={field}>
              <label className="text-sm font-medium text-[var(--theme-text)] block mb-1">
                {field === 'accountant_bank_account_name' ? 'Account name' : field === 'accountant_sort_code' ? 'Sort code' : 'Account number'}
              </label>
              <input
                type="text"
                value={details[field] ?? ''}
                onChange={e => setDetails(prev => ({ ...prev, [field]: e.target.value }))}
                className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)]"
              />
            </div>
          ))}
          <button onClick={saveDetails} className="rounded-lg bg-[var(--theme-primary)] text-white px-4 py-2 text-sm font-medium">
            {saved ? 'Saved!' : 'Save Bank Details'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-[var(--theme-text)] mb-1">Commission Earnings</h2>
        <p className="text-sm text-[var(--theme-text-muted)] mb-4">
          Total: <strong>£{(totalPence / 100).toFixed(2)}</strong> — paid manually to your bank account.
        </p>
        {earnings.length === 0 ? (
          <p className="text-sm text-[var(--theme-text-muted)]">No earnings yet. Commission appears here when referred clients pay their subscription.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--theme-text-muted)] border-b border-[var(--theme-border)]">
                <th className="pb-2 font-medium">Client</th>
                <th className="pb-2 font-medium">Subscription</th>
                <th className="pb-2 font-medium text-right">Commission</th>
                <th className="pb-2 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map(e => (
                <tr key={e.id} className="border-b border-[var(--theme-border)]/50">
                  <td className="py-2 text-[var(--theme-text)]">{e.client_name}{e.client_business ? ` · ${e.client_business}` : ''}</td>
                  <td className="py-2 text-[var(--theme-text-muted)]">£{(e.gross_amount / 100).toFixed(2)}</td>
                  <td className="py-2 text-[var(--theme-success)] text-right">£{(e.commission_amount / 100).toFixed(2)}</td>
                  <td className="py-2 text-[var(--theme-text-muted)] text-right">{new Date(e.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/dashboard/accountant/settings/page.tsx
git commit -m "feat: accountant settings page - bank details form + commission earnings table"
```

---

## Task 24: Create `src/components/AccountantBanner.tsx`

**Files:**
- Create: `apps/22accounting/src/components/AccountantBanner.tsx`

Shows when `isAccountantAccess` is true — displays client name and "Return to portal" button.

- [ ] **Step 1: Create the file**

```tsx
'use client';

import { useRouter } from 'next/navigation';

interface AccountantBannerProps {
  clientName: string;
}

export function AccountantBanner({ clientName }: AccountantBannerProps) {
  const router = useRouter();

  async function returnToPortal() {
    await fetch('/api/accountant/switch', { method: 'DELETE' });
    router.push('/dashboard/accountant');
  }

  return (
    <div className="w-full bg-[var(--theme-accent)]/10 border-b border-[var(--theme-accent)]/20 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-[var(--theme-text)]">
        Viewing as <strong>{clientName}</strong>
      </span>
      <button
        onClick={returnToPortal}
        className="text-[var(--theme-accent)] font-medium hover:underline"
      >
        ← Return to portal
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/src/components/AccountantBanner.tsx
git commit -m "feat: AccountantBanner component - shows client name + return-to-portal button"
```

---

## Task 25: Update `app/dashboard/layout.tsx` to show AccountantBanner

**Files:**
- Modify: `apps/22accounting/app/dashboard/layout.tsx`

The layout fetches `/api/auth/me` to populate UserMenu. Read the current file, then:
1. Import `AccountantBanner`
2. Check `data.isAccountantAccess` from the `/api/auth/me` response
3. Render `<AccountantBanner clientName={data.fullName} />` above the main content

- [ ] **Step 1: Add banner to the layout**

After `import` statements, add:

```typescript
import { AccountantBanner } from '@/components/AccountantBanner';
```

In the JSX, wrap the existing return to inject the banner when `isAccountantAccess` is true:

```tsx
return (
  <>
    {user?.isAccountantAccess && <AccountantBanner clientName={user.fullName} />}
    {/* existing layout content unchanged */}
    ...
  </>
);
```

The `user` object comes from the existing `/api/auth/me` fetch. Ensure `isAccountantAccess` is returned from `/api/auth/me`. Check `app/api/auth/me/route.ts` — it should return the full JWT payload. If `isAccountantAccess` isn't included, add it to the response.

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/dashboard/layout.tsx apps/22accounting/app/api/auth/me/route.ts
git commit -m "feat: layout shows AccountantBanner when accountant is viewing client account"
```

---

## Task 26: Add Accountant tab to client Settings page

**Files:**
- Modify: `apps/22accounting/app/dashboard/settings/page.tsx` (or wherever the Settings page lives — check with `ls apps/22accounting/app/dashboard/settings/`)

Add a new "Accountant" tab that lets clients:
1. See their current accountant (if any)
2. Invite an accountant by email
3. Revoke accountant access

- [ ] **Step 1: Find the settings page and add the tab**

First check: `ls apps/22accounting/app/dashboard/settings/`

The settings page likely uses a tab pattern. Add a new tab entry for "Accountant" that renders:

```tsx
// Inside the Accountant tab content:
function AccountantSettings() {
  const [accountant, setAccountant] = useState<{ accountant_name: string; accountant_email: string; accountant_firm: string | null; accepted_at: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/accountant').then(r => r.json()).then(d => {
      setAccountant(d.accountant);
      setLoading(false);
    });
  }, []);

  async function inviteAccountant() {
    const r = await fetch('/api/settings/accountant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountantEmail: inviteEmail }),
    });
    setMsg(r.ok ? 'Invite sent!' : 'Accountant not found — make sure they have a Relentify accountant account.');
    if (r.ok) setInviteEmail('');
  }

  async function revokeAccountant() {
    if (!confirm('Remove accountant access?')) return;
    await fetch('/api/settings/accountant', { method: 'DELETE' });
    setAccountant(null);
  }

  if (loading) return <p className="text-sm text-[var(--theme-text-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      {accountant ? (
        <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-xl p-5">
          <p className="text-sm text-[var(--theme-text-muted)] mb-1">Current accountant</p>
          <p className="font-medium text-[var(--theme-text)]">{accountant.accountant_name}{accountant.accountant_firm ? ` · ${accountant.accountant_firm}` : ''}</p>
          <p className="text-sm text-[var(--theme-text-muted)]">{accountant.accountant_email}</p>
          <button onClick={revokeAccountant} className="mt-3 text-sm text-[var(--theme-destructive)] hover:underline">
            Remove accountant access
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[var(--theme-text-muted)] mb-4">You don't have an accountant connected. Enter their Relentify accountant email to invite them.</p>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="accountant@example.com"
              className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)]"
            />
            <button
              onClick={inviteAccountant}
              disabled={!inviteEmail}
              className="rounded-lg border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)] disabled:opacity-50"
            >
              Send Invite
            </button>
          </div>
          {msg && <p className="text-sm mt-2 text-[var(--theme-text-muted)]">{msg}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/22accounting/app/dashboard/settings/
git commit -m "feat: settings page Accountant tab - invite/view/revoke accountant"
```

---

## Task 27: Docker rebuild and verify

- [ ] **Step 1: Rebuild 22accounting**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml down
docker compose -f apps/22accounting/docker-compose.yml build --no-cache 2>&1 | tail -30
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 50
```

Expected: clean build, container starts, no import errors in logs.

- [ ] **Step 2: Rebuild 21auth (register page changed)**

```bash
docker compose -f apps/21auth/docker-compose.yml down
docker compose -f apps/21auth/docker-compose.yml build --no-cache 2>&1 | tail -30
docker compose -f apps/21auth/docker-compose.yml up -d
docker logs 21auth --tail 30
```

- [ ] **Step 3: Smoke test the accountant flow**

```bash
# 1. Register an accountant account at https://accounts.relentify.com/register
#    Toggle "I'm an accountant", fill in email + name + password, submit
#    → should redirect to /dashboard/accountant (not /dashboard)

# 2. Verify accountant portal loads
curl -s -b "<accountant_cookie>" https://accounts.relentify.com/api/accountant/clients
# Expected: []

# 3. Send an invite to a test client email
curl -s -X POST https://accounts.relentify.com/api/accountant/invite \
  -H "Content-Type: application/json" \
  -b "<accountant_cookie>" \
  -d '{"email":"testclient@example.com"}'
# Expected: {"ok":true,"inviteId":"<uuid>"}

# 4. Verify invite is in DB
docker exec -it infra-postgres psql -U relentify_user -d relentify \
  -c "SELECT id, status, invite_email FROM accountant_clients LIMIT 5;"
```

- [ ] **Step 4: Prune build cache**

```bash
docker builder prune -f
```

- [ ] **Step 5: Update CLAUDE.md**

Update `apps/22accounting/CLAUDE.md` — mark item #28 as ✅ in Priority 7, add notes about new tables/files.

- [ ] **Step 6: Final commit**

```bash
git add apps/22accounting/CLAUDE.md
git commit -m "docs: mark accountant multi-client (#28) complete in CLAUDE.md"
```

---

## Summary of New Tables

| Table | Purpose |
|-------|---------|
| `accountant_clients` | Invite lifecycle + access status per accountant-client pair |
| `accountant_referral_earnings` | Commission ledger per Stripe invoice (idempotent) |
| `audit_log.actor_id` | New column — who performed the action (NULL = user acted for themselves) |

## Summary of New API Routes

| Route | Method | Who calls it |
|-------|--------|-------------|
| `/api/accountant/invite` | POST | Accountant sends invite; client sends invite to accountant |
| `/api/accountant/invite/accept` | POST | Client accepts accountant's invite |
| `/api/accountant/clients` | GET | Accountant — list clients + health stats |
| `/api/accountant/clients/[id]` | DELETE | Accountant — revoke a client |
| `/api/accountant/switch` | POST | Accountant — enter client account (sets client cookie) |
| `/api/accountant/switch` | DELETE | Accountant — exit client account (clears client cookie) |
| `/api/accountant/bank-details` | GET/PUT | Accountant — manage bank details for commission |
| `/api/accountant/earnings` | GET | Accountant — view referral commission history |
| `/api/settings/accountant` | GET/POST/DELETE | Client — view/invite/remove their accountant |
