# Approval Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-staff PO approver mapping + 24h escalation cron (#31), and a full expense/mileage approval workflow with email notifications (#15), sharing a common settings infrastructure.

**Architecture:** A new `po_approver_mappings` table routes each team member's POs to their specific approver (falling back to the existing entity-wide `po_settings.approver_user_id`). A new `expense_approval_settings` table enables expense approval per entity. Expenses gain an approval status machine (`pending_approval → approved/rejected`); GL posts on approval not creation when approval is enabled. Approvers act in-app; email notifies them on submission. 24h PO escalation runs hourly via the existing cron container.

**Tech Stack:** Next.js 14 App Router, TypeScript, PostgreSQL (`query` from `lib/db`), Resend email (`lib/email.ts`), existing `postJournalEntry()`, `logAudit()`, `canAccess()` tier gating.

---

## Context: What already exists

- **PO approval**: Full flow (po_settings, approval tokens, in-app + email-link approve/reject). Only missing: per-staff approver routing + 24h escalation.
- **Expenses/mileage**: No approval. Status is `'pending' | 'reimbursed'`. GL posts at creation.
- **Cron**: Alpine container, runs `wget http://web:3000/api/cron/reminders` every 3600s.
- **Email functions**: `sendPOApprovalRequestEmail`, `sendPODecisionEmail` exist in `lib/email.ts`.
- **Auth pattern**: `getAuthUser()` → JWT only. `getActiveEntity(auth.userId)` for entity. `getUserById(auth.userId)` for tier.
- **Latest migration**: 018. Next is **019**.

---

## Task 1: Database Migration 019

**Files:**
- Create: `database/migrations/019_approval_workflows.sql`

**Step 1: Write the migration**

```sql
-- 019_approval_workflows.sql
-- Per-staff PO approver mappings + expense approval infrastructure

-- Per-staff PO approver overrides
-- When a team member creates a PO, we check here first; fall back to po_settings.approver_user_id
CREATE TABLE po_approver_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, staff_user_id)
);
CREATE INDEX idx_po_approver_mappings_entity ON po_approver_mappings(entity_id);

-- Track whether a PO escalation reminder has been sent (prevents repeat emails)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS escalation_sent_at TIMESTAMPTZ;

-- Expense approval settings per entity
CREATE TABLE expense_approval_settings (
  entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval columns on expenses
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Approval columns on mileage_claims
ALTER TABLE mileage_claims
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Expense status now supports: pending | pending_approval | approved | rejected | reimbursed
-- No constraint change needed — status is VARCHAR with no check constraint.
-- Existing 'pending' records are unaffected.
```

**Step 2: Apply migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-accounts/database/migrations/019_approval_workflows.sql
```

**Step 3: Verify**

```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d po_approver_mappings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d expense_approval_settings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d expenses" | grep approved
```

Expected: tables exist, `expenses` has `approved_by_id`, `approved_at`, `rejected_at`, `rejection_reason` columns.

---

## Task 2: PO Approver Mapping Service

**Files:**
- Create: `lib/services/po_approver_mapping.service.ts`
- Modify: `lib/services/po.service.ts`

**Step 1: Create the mapping service**

```typescript
// lib/services/po_approver_mapping.service.ts
import { query } from '../db';

export interface POApproverMapping {
  id: string;
  entity_id: string;
  staff_user_id: string;
  staff_name?: string;
  approver_user_id: string;
  approver_name?: string;
  created_at: string;
}

/** Returns all per-staff mappings for an entity, with names joined */
export async function getPOApproverMappings(entityId: string): Promise<POApproverMapping[]> {
  const r = await query(
    `SELECT m.*,
            s.full_name AS staff_name,
            a.full_name AS approver_name
     FROM po_approver_mappings m
     JOIN users s ON s.id = m.staff_user_id
     JOIN users a ON a.id = m.approver_user_id
     WHERE m.entity_id = $1
     ORDER BY s.full_name ASC`,
    [entityId]
  );
  return r.rows;
}

/** Upsert: set the approver for a specific staff member */
export async function upsertPOApproverMapping(
  entityId: string,
  staffUserId: string,
  approverUserId: string
): Promise<POApproverMapping> {
  const r = await query(
    `INSERT INTO po_approver_mappings (entity_id, staff_user_id, approver_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_id, staff_user_id)
     DO UPDATE SET approver_user_id = EXCLUDED.approver_user_id
     RETURNING *`,
    [entityId, staffUserId, approverUserId]
  );
  return r.rows[0];
}

/** Remove a staff→approver mapping */
export async function deletePOApproverMapping(entityId: string, staffUserId: string): Promise<void> {
  await query(
    `DELETE FROM po_approver_mappings WHERE entity_id = $1 AND staff_user_id = $2`,
    [entityId, staffUserId]
  );
}

/**
 * Resolve the approver for a PO created by staffUserId.
 * Checks per-staff mapping first; falls back to po_settings.approver_user_id.
 * Returns null if no approver is configured.
 */
export async function resolveApproverForStaff(
  entityId: string,
  staffUserId: string
): Promise<string | null> {
  // Check per-staff override
  const mapRes = await query(
    `SELECT approver_user_id FROM po_approver_mappings
     WHERE entity_id = $1 AND staff_user_id = $2`,
    [entityId, staffUserId]
  );
  if (mapRes.rows[0]?.approver_user_id) return mapRes.rows[0].approver_user_id;

  // Fall back to entity-wide po_settings
  const settingsRes = await query(
    `SELECT approver_user_id FROM po_settings WHERE entity_id = $1 AND enabled = true`,
    [entityId]
  );
  return settingsRes.rows[0]?.approver_user_id ?? null;
}
```

**Step 2: Update `po.service.ts` — use resolveApproverForStaff when creating POs**

Find the `createPO` (or equivalent) function in `lib/services/po.service.ts`. Locate where it fetches the approver from `po_settings` and replace that lookup with `resolveApproverForStaff`.

Read the file first, then replace the approver-resolution block. The change is typically:

```typescript
// Before (inside createPO):
const settings = await getPOSettings(entityId);
const approverId = settings?.approver_user_id;

// After:
import { resolveApproverForStaff } from './po_approver_mapping.service';
const approverId = await resolveApproverForStaff(entityId, requestedById);
```

**Step 3: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

Expected: no new errors.

---

## Task 3: PO Approver Mappings API Routes

**Files:**
- Create: `app/api/po/approver-mappings/route.ts`
- Create: `app/api/po/approver-mappings/[staffId]/route.ts`

**Step 1: Create collection route**

```typescript
// app/api/po/approver-mappings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import {
  getPOApproverMappings,
  upsertPOApproverMapping,
} from '@/lib/services/po_approver_mapping.service';
import { logAudit } from '@/lib/services/audit.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const mappings = await getPOApproverMappings(entity.id);
    return NextResponse.json({ mappings });
  } catch (e) {
    console.error('GET po/approver-mappings error:', e);
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { staffUserId, approverUserId } = await req.json();
    if (!staffUserId || !approverUserId) return NextResponse.json({ error: 'staffUserId and approverUserId required' }, { status: 400 });

    const mapping = await upsertPOApproverMapping(entity.id, staffUserId, approverUserId);
    await logAudit(auth.userId, 'upsert', 'po_approver_mapping', mapping.id, { staffUserId, approverUserId });
    return NextResponse.json({ mapping });
  } catch (e) {
    console.error('POST po/approver-mappings error:', e);
    return NextResponse.json({ error: 'Failed to save mapping' }, { status: 500 });
  }
}
```

**Step 2: Create delete route**

```typescript
// app/api/po/approver-mappings/[staffId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { deletePOApproverMapping } from '@/lib/services/po_approver_mapping.service';
import { logAudit } from '@/lib/services/audit.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { staffId } = await params;
    await deletePOApproverMapping(entity.id, staffId);
    await logAudit(auth.userId, 'delete', 'po_approver_mapping', staffId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE po/approver-mappings error:', e);
    return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
  }
}
```

**Step 3: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 4: Expense Approval Service + Email

**Files:**
- Create: `lib/services/expense_approval.service.ts`
- Modify: `lib/services/expense.service.ts`
- Modify: `lib/email.ts`

**Step 1: Create expense approval service**

```typescript
// lib/services/expense_approval.service.ts
import { query } from '../db';

export interface ExpenseApprovalSettings {
  entity_id: string;
  enabled: boolean;
  approver_user_id: string | null;
}

export async function getExpenseApprovalSettings(entityId: string): Promise<ExpenseApprovalSettings | null> {
  const r = await query(
    `SELECT * FROM expense_approval_settings WHERE entity_id = $1`,
    [entityId]
  );
  return r.rows[0] ?? null;
}

export async function upsertExpenseApprovalSettings(
  entityId: string,
  data: { enabled: boolean; approverUserId: string | null }
): Promise<ExpenseApprovalSettings> {
  const r = await query(
    `INSERT INTO expense_approval_settings (entity_id, enabled, approver_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (entity_id)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   approver_user_id = EXCLUDED.approver_user_id,
                   updated_at = NOW()
     RETURNING *`,
    [entityId, data.enabled, data.approverUserId]
  );
  return r.rows[0];
}

/** Approve an expense. Returns null if not found / wrong state. */
export async function approveExpense(
  id: string,
  entityId: string,
  approverId: string
): Promise<{ id: string; user_id: string; date: string; description: string; gross_amount: string; category: string; coa_account_id: string | null } | null> {
  const r = await query(
    `UPDATE expenses
     SET status = 'approved', approved_by_id = $3, approved_at = NOW()
     WHERE id = $1
       AND id IN (SELECT e.id FROM expenses e
                  JOIN users u ON u.id = e.user_id
                  JOIN entities en ON en.id = $2
                  WHERE e.id = $1)
       AND status = 'pending_approval'
     RETURNING *`,
    [id, entityId, approverId]
  );
  return r.rows[0] ?? null;
}

/** Reject an expense. Returns null if not found / wrong state. */
export async function rejectExpense(
  id: string,
  entityId: string,
  approverId: string,
  reason: string
): Promise<{ id: string; user_id: string } | null> {
  const r = await query(
    `UPDATE expenses
     SET status = 'rejected', approved_by_id = $3, rejected_at = NOW(), rejection_reason = $4
     WHERE id = $1
       AND id IN (SELECT e.id FROM expenses e
                  JOIN users u ON u.id = e.user_id
                  JOIN entities en ON en.id = $2
                  WHERE e.id = $1)
       AND status = 'pending_approval'
     RETURNING *`,
    [id, entityId, approverId, reason]
  );
  return r.rows[0] ?? null;
}

/** Approve a mileage claim. Returns null if not found / wrong state. */
export async function approveMileage(
  id: string,
  entityId: string,
  approverId: string
): Promise<{ id: string; user_id: string; date: string; description: string; amount: string; coa_account_id: string | null } | null> {
  const r = await query(
    `UPDATE mileage_claims
     SET approved_by_id = $3, approved_at = NOW()
     WHERE id = $1
       AND id IN (SELECT m.id FROM mileage_claims m
                  JOIN users u ON u.id = m.user_id
                  JOIN entities en ON en.id = $2
                  WHERE m.id = $1)
       AND approved_at IS NULL AND rejected_at IS NULL
     RETURNING *`,
    [id, entityId, approverId]
  );
  return r.rows[0] ?? null;
}

/** Reject a mileage claim. Returns null if not found / wrong state. */
export async function rejectMileage(
  id: string,
  entityId: string,
  approverId: string,
  reason: string
): Promise<{ id: string; user_id: string } | null> {
  const r = await query(
    `UPDATE mileage_claims
     SET approved_by_id = $3, rejected_at = NOW(), rejection_reason = $4
     WHERE id = $1
       AND id IN (SELECT m.id FROM mileage_claims m
                  JOIN users u ON u.id = m.user_id
                  JOIN entities en ON en.id = $2
                  WHERE m.id = $1)
       AND approved_at IS NULL AND rejected_at IS NULL
     RETURNING *`,
    [id, entityId, approverId, reason]
  );
  return r.rows[0] ?? null;
}

/** Get all expenses pending approval for a given entity where approver_user_id matches */
export async function getPendingExpensesForApprover(
  entityId: string,
  approverUserId: string
): Promise<any[]> {
  // Entity is needed to scope — we join expenses.user_id → workspace_members where owner = entity user
  const r = await query(
    `SELECT e.*, u.full_name AS submitter_name
     FROM expenses e
     JOIN users u ON u.id = e.user_id
     WHERE e.status = 'pending_approval'
       AND EXISTS (
         SELECT 1 FROM expense_approval_settings eas
         WHERE eas.entity_id = $1
           AND eas.approver_user_id = $2
           AND eas.enabled = true
       )
       AND (
         e.user_id = $1
         OR EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.owner_user_id = (
             SELECT user_id FROM entities WHERE id = $1
           )
           AND wm.member_user_id = e.user_id
           AND wm.status = 'active'
         )
       )
     ORDER BY e.date DESC, e.created_at DESC`,
    [entityId, approverUserId]
  );
  return r.rows;
}

/** Get all mileage claims pending approval */
export async function getPendingMileageForApprover(
  entityId: string,
  approverUserId: string
): Promise<any[]> {
  const r = await query(
    `SELECT m.*, u.full_name AS submitter_name
     FROM mileage_claims m
     JOIN users u ON u.id = m.user_id
     WHERE m.approved_at IS NULL AND m.rejected_at IS NULL
       AND EXISTS (
         SELECT 1 FROM expense_approval_settings eas
         WHERE eas.entity_id = $1
           AND eas.approver_user_id = $2
           AND eas.enabled = true
       )
       AND (
         m.user_id = $1
         OR EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.owner_user_id = (
             SELECT user_id FROM entities WHERE id = $1
           )
           AND wm.member_user_id = m.user_id
           AND wm.status = 'active'
         )
       )
     ORDER BY m.date DESC, m.created_at DESC`,
    [entityId, approverUserId]
  );
  return r.rows;
}
```

**Step 2: Update expense.service.ts — conditional GL posting**

In `lib/services/expense.service.ts`, update the `Expense` interface and `createExpense` function:

```typescript
// Update Expense interface status union:
status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'reimbursed';

// In createExpense, add entityId lookup for approval settings:
export async function createExpense(userId: string, data: {
  entityId?: string;
  date: string;
  description: string;
  category?: string;
  coaAccountId?: string;
  grossAmount: number;
  vatAmount?: number;
  notes?: string;
}) {
  // Determine if approval is required
  let status = 'pending';
  if (data.entityId) {
    const { getExpenseApprovalSettings } = await import('./expense_approval.service');
    const approvalSettings = await getExpenseApprovalSettings(data.entityId);
    if (approvalSettings?.enabled && approvalSettings.approver_user_id) {
      status = 'pending_approval';
    }
  }

  const r = await query(
    `INSERT INTO expenses (user_id, date, description, category, coa_account_id, gross_amount, vat_amount, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      userId,
      data.date,
      data.description,
      data.category || 'general',
      data.coaAccountId || null,
      data.grossAmount,
      data.vatAmount ?? 0,
      data.notes || null,
      status,
    ]
  );
  const expense = r.rows[0] as Expense;

  // Post GL immediately only when NOT requiring approval
  if (status !== 'pending_approval' && data.entityId) {
    try {
      let expenseAccountId = data.coaAccountId;
      if (!expenseAccountId) {
        const code = EXPENSE_CATEGORY_TO_CODE[data.category || ''] || 7900;
        const acct = await getAccountByCode(data.entityId, code);
        expenseAccountId = acct?.id;
      }
      if (expenseAccountId) {
        const glLines = await buildExpenseLines(data.entityId, data.grossAmount, expenseAccountId);
        await postJournalEntry({
          entityId:    data.entityId,
          userId,
          date:        data.date,
          description: `Expense: ${data.description}`,
          sourceType:  'expense',
          sourceId:    expense.id,
          lines:       glLines,
        });
      }
    } catch (_glErr) {
      console.error('[GL] Failed to post expense entry:', _glErr);
    }
  }

  return expense;
}
```

Also update `markExpenseReimbursed` to allow both `'pending'` and `'approved'` status:

```typescript
export async function markExpenseReimbursed(userId: string, id: string) {
  const r = await query(
    `UPDATE expenses SET status = 'reimbursed'
     WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'approved')
     RETURNING *`,
    [id, userId]
  );
  return r.rows[0] as Expense || null;
}
```

**Step 3: Add email functions to lib/email.ts**

At the end of `lib/email.ts`, add:

```typescript
// ─── Expense Approval ────────────────────────────────────────────────────────

interface ExpenseApprovalRequestEmailParams {
  recipientEmail: string;
  recipientName: string;
  submitterName: string;
  expenseDescription: string;
  expenseAmount: string;   // formatted e.g. "£45.00"
  expenseDate: string;     // e.g. "09 Mar 2026"
  appUrl: string;          // link to expenses page
}

export async function sendExpenseApprovalRequestEmail(params: ExpenseApprovalRequestEmailParams) {
  const { recipientEmail, recipientName, submitterName, expenseDescription, expenseAmount, expenseDate, appUrl } = params;
  await resend.emails.send({
    from: 'invoices@relentify.com',
    to: recipientEmail,
    subject: `Expense pending approval — ${expenseDescription}`,
    html: `${EMAIL_BASE_STYLE}
      <div class="card">
        <div class="header">Expense Approval Required</div>
        <p>Hi ${recipientName},</p>
        <p><strong>${submitterName}</strong> has submitted an expense for your approval.</p>
        <div class="row"><span class="lbl">Description</span><span class="val">${expenseDescription}</span></div>
        <div class="row"><span class="lbl">Amount</span><span class="val">${expenseAmount}</span></div>
        <div class="row"><span class="lbl">Date</span><span class="val">${expenseDate}</span></div>
        <div style="text-align:center;margin-top:28px;">
          <a href="${appUrl}" class="btn">Review Expense</a>
        </div>
      </div>
    `,
  });
}

interface ExpenseDecisionEmailParams {
  recipientEmail: string;
  recipientName: string;
  approverName: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  expenseDescription: string;
  expenseAmount: string;
}

export async function sendExpenseDecisionEmail(params: ExpenseDecisionEmailParams) {
  const { recipientEmail, recipientName, approverName, decision, rejectionReason, expenseDescription, expenseAmount } = params;
  const subject = decision === 'approved'
    ? `Expense approved — ${expenseDescription}`
    : `Expense rejected — ${expenseDescription}`;
  await resend.emails.send({
    from: 'invoices@relentify.com',
    to: recipientEmail,
    subject,
    html: `${EMAIL_BASE_STYLE}
      <div class="card">
        <div class="header">Expense ${decision === 'approved' ? 'Approved' : 'Rejected'}</div>
        <p>Hi ${recipientName},</p>
        <p>Your expense has been <strong>${decision}</strong> by ${approverName}.</p>
        <div class="row"><span class="lbl">Description</span><span class="val">${expenseDescription}</span></div>
        <div class="row"><span class="lbl">Amount</span><span class="val">${expenseAmount}</span></div>
        ${rejectionReason ? `<div class="row"><span class="lbl">Reason</span><span class="val">${rejectionReason}</span></div>` : ''}
      </div>
    `,
  });
}
```

**Step 4: Check what EMAIL_BASE_STYLE and EMAIL_BTN_STYLE constants are called in email.ts**

Read `lib/email.ts` around line 1–30 to find the correct constant name for the base HTML styles, then use the exact same name in the new functions above.

**Step 5: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 5: Expense + Mileage Approval API Routes

**Files:**
- Create: `app/api/expenses/[id]/approve/route.ts`
- Create: `app/api/expenses/[id]/reject/route.ts`
- Create: `app/api/mileage/[id]/approve/route.ts`
- Create: `app/api/mileage/[id]/reject/route.ts`
- Create: `app/api/expense-approval-settings/route.ts`

**Step 1: Expense approve route**

```typescript
// app/api/expenses/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { approveExpense, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { postJournalEntry, buildExpenseLines } from '@/lib/services/general_ledger.service';
import { getAccountByCode } from '@/lib/services/chart_of_accounts.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

const EXPENSE_CATEGORY_TO_CODE: Record<string, number> = {
  advertising: 7100, entertainment: 7200, equipment: 1700, general: 7900,
  insurance: 8000, it_software: 7500, marketing: 7100, office: 7400,
  professional: 7600, rent: 8100, repairs: 8200, subscriptions: 8300,
  travel: 7300, utilities: 8400,
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to approve expenses' }, { status: 403 });
    }

    const { id } = await params;
    const expense = await approveExpense(id, entity.id, auth.userId);
    if (!expense) return NextResponse.json({ error: 'Cannot approve — expense not found or not pending' }, { status: 400 });

    // Post GL on approval
    try {
      let expenseAccountId = expense.coa_account_id;
      if (!expenseAccountId) {
        const code = EXPENSE_CATEGORY_TO_CODE[expense.category] || 7900;
        const acct = await getAccountByCode(entity.id, code);
        expenseAccountId = acct?.id ?? null;
      }
      if (expenseAccountId) {
        const glLines = await buildExpenseLines(entity.id, parseFloat(expense.gross_amount), expenseAccountId);
        await postJournalEntry({
          entityId: entity.id, userId: auth.userId,
          date: expense.date, description: `Expense (approved): ${expense.description}`,
          sourceType: 'expense', sourceId: expense.id, lines: glLines,
        });
      }
    } catch (_glErr) { console.error('[GL] Expense approval GL error:', _glErr); }

    await logAudit(auth.userId, 'approve', 'expense', id);

    // Notify submitter
    const user = await getUserById(auth.userId);
    const submitterRes = await query(`SELECT email, full_name FROM users WHERE id = $1`, [expense.user_id]);
    const submitter = submitterRes.rows[0];
    if (submitter?.email && submitter.email !== auth.email) {
      await sendExpenseDecisionEmail({
        recipientEmail: submitter.email,
        recipientName: submitter.full_name,
        approverName: user?.full_name || 'Your approver',
        decision: 'approved',
        expenseDescription: expense.description,
        expenseAmount: `£${parseFloat(expense.gross_amount).toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Expense approve error:', e);
    return NextResponse.json({ error: 'Failed to approve expense' }, { status: 500 });
  }
}
```

**Step 2: Expense reject route**

```typescript
// app/api/expenses/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { rejectExpense, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to reject expenses' }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();
    if (!reason?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const expense = await rejectExpense(id, entity.id, auth.userId, reason);
    if (!expense) return NextResponse.json({ error: 'Cannot reject — expense not found or not pending' }, { status: 400 });

    await logAudit(auth.userId, 'reject', 'expense', id, { reason });

    const user = await getUserById(auth.userId);
    const submitterRes = await query(`SELECT email, full_name, gross_amount, description FROM expenses e JOIN users u ON u.id = e.user_id WHERE e.id = $1`, [id]);
    const row = submitterRes.rows[0];
    if (row?.email && row.email !== auth.email) {
      await sendExpenseDecisionEmail({
        recipientEmail: row.email,
        recipientName: row.full_name,
        approverName: user?.full_name || 'Your approver',
        decision: 'rejected',
        rejectionReason: reason,
        expenseDescription: row.description || '',
        expenseAmount: `£${parseFloat(row.gross_amount || '0').toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Expense reject error:', e);
    return NextResponse.json({ error: 'Failed to reject expense' }, { status: 500 });
  }
}
```

**Step 3: Mileage approve route** — same pattern as expense approve, but calls `approveMileage` and uses `buildMileageLines`:

```typescript
// app/api/mileage/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { approveMileage, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { postJournalEntry, buildMileageLines } from '@/lib/services/general_ledger.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to approve mileage' }, { status: 403 });
    }

    const { id } = await params;
    const claim = await approveMileage(id, entity.id, auth.userId);
    if (!claim) return NextResponse.json({ error: 'Cannot approve — mileage claim not found or already actioned' }, { status: 400 });

    // Post GL on approval
    try {
      const glLines = await buildMileageLines(entity.id, parseFloat(claim.amount), claim.coa_account_id ?? undefined);
      await postJournalEntry({
        entityId: entity.id, userId: auth.userId,
        date: claim.date, description: `Mileage (approved): ${claim.description}`,
        sourceType: 'mileage', sourceId: claim.id, lines: glLines,
      });
    } catch (_glErr) { console.error('[GL] Mileage approval GL error:', _glErr); }

    await logAudit(auth.userId, 'approve', 'mileage_claim', id);

    const user = await getUserById(auth.userId);
    const submitterRes = await query(`SELECT email, full_name FROM users WHERE id = $1`, [claim.user_id]);
    const submitter = submitterRes.rows[0];
    if (submitter?.email && submitter.email !== auth.email) {
      await sendExpenseDecisionEmail({
        recipientEmail: submitter.email,
        recipientName: submitter.full_name,
        approverName: user?.full_name || 'Your approver',
        decision: 'approved',
        expenseDescription: claim.description,
        expenseAmount: `£${parseFloat(claim.amount).toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Mileage approve error:', e);
    return NextResponse.json({ error: 'Failed to approve mileage claim' }, { status: 500 });
  }
}
```

**Step 4: Mileage reject route**

```typescript
// app/api/mileage/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { rejectMileage, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to reject mileage' }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();
    if (!reason?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 });

    const claim = await rejectMileage(id, entity.id, auth.userId, reason);
    if (!claim) return NextResponse.json({ error: 'Cannot reject — mileage claim not found or already actioned' }, { status: 400 });

    await logAudit(auth.userId, 'reject', 'mileage_claim', id, { reason });

    const user = await getUserById(auth.userId);
    const row = await query(
      `SELECT u.email, u.full_name, m.amount, m.description FROM mileage_claims m JOIN users u ON u.id = m.user_id WHERE m.id = $1`,
      [id]
    );
    const r = row.rows[0];
    if (r?.email && r.email !== auth.email) {
      await sendExpenseDecisionEmail({
        recipientEmail: r.email,
        recipientName: r.full_name,
        approverName: user?.full_name || 'Your approver',
        decision: 'rejected',
        rejectionReason: reason,
        expenseDescription: r.description || '',
        expenseAmount: `£${parseFloat(r.amount || '0').toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Mileage reject error:', e);
    return NextResponse.json({ error: 'Failed to reject mileage claim' }, { status: 500 });
  }
}
```

**Step 5: Expense approval settings API**

```typescript
// app/api/expense-approval-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { getExpenseApprovalSettings, upsertExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const settings = await getExpenseApprovalSettings(entity.id);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { enabled, approverUserId } = await req.json();
    const settings = await upsertExpenseApprovalSettings(entity.id, {
      enabled: Boolean(enabled),
      approverUserId: approverUserId || null,
    });
    await logAudit(auth.userId, 'update', 'expense_approval_settings', entity.id, { enabled, approverUserId });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
```

**Step 6: Also add a GET endpoint for pending approvals**

```typescript
// app/api/expense-approval-settings/pending/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getPendingExpensesForApprover, getPendingMileageForApprover } from '@/lib/services/expense_approval.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const [expenses, mileage] = await Promise.all([
      getPendingExpensesForApprover(entity.id, auth.userId),
      getPendingMileageForApprover(entity.id, auth.userId),
    ]);

    return NextResponse.json({ expenses, mileage });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch pending approvals' }, { status: 500 });
  }
}
```

**Step 7: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 6: Settings UI — Expense Approval + PO Approver Mapping

**Files:**
- Modify: `app/dashboard/settings/SettingsForm.tsx`

This task adds two new sections to the `activeTab === 'po'` panel (which is already tier-gated to medium_business+).

**Step 1: Add state variables** after the existing PO settings state block (search for `const [poEnabled` or similar):

```typescript
// Expense approval settings
const [expApprovalEnabled, setExpApprovalEnabled] = useState(false);
const [expApprovalApprover, setExpApprovalApprover] = useState('');
const [expApprovalSaved, setExpApprovalSaved] = useState('');
const [expApprovalError, setExpApprovalError] = useState('');
const [expApprovalLoading, setExpApprovalLoading] = useState(false);

// PO per-staff approver mappings
const [poMappings, setPoMappings] = useState<Array<{ id: string; staff_user_id: string; staff_name: string; approver_user_id: string; approver_name: string }>>([]);
const [poMappingStaff, setPoMappingStaff] = useState('');
const [poMappingApprover, setPoMappingApprover] = useState('');
const [poMappingLoading, setPoMappingLoading] = useState(false);
const [poMappingError, setPoMappingError] = useState('');
```

**Step 2: Load expense approval settings and PO mappings alongside existing PO settings load**

Find the existing `useEffect` (or load function) that fetches PO settings (searches for `/api/po/settings`). Add to that same function:

```typescript
// Load expense approval settings
const expRes = await fetch('/api/expense-approval-settings');
if (expRes.ok) {
  const { settings } = await expRes.json();
  if (settings) {
    setExpApprovalEnabled(settings.enabled);
    setExpApprovalApprover(settings.approver_user_id || '');
  }
}

// Load PO approver mappings
const mapRes = await fetch('/api/po/approver-mappings');
if (mapRes.ok) {
  const { mappings } = await mapRes.json();
  setPoMappings(mappings || []);
}
```

**Step 3: Add expense approval UI section** — inside `activeTab === 'po'` panel, after the existing PO settings save button, add:

```tsx
{/* ── Expense & Mileage Approval ─────────────────────── */}
<div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.07]">
  <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
    Expense & Mileage Approval
  </h3>
  <div className="space-y-4">
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={expApprovalEnabled}
        onChange={e => setExpApprovalEnabled(e.target.checked)}
        className="w-4 h-4 rounded accent-emerald-500"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">Enable expense & mileage approval</span>
    </label>

    {expApprovalEnabled && (
      <div>
        <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Approver</label>
        <select
          value={expApprovalApprover}
          onChange={e => setExpApprovalApprover(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">— Select approver —</option>
          {/* teamMembers array already loaded by PO settings section */}
          {teamMembers.map((m: any) => (
            <option key={m.member_user_id || m.id} value={m.member_user_id || m.id}>
              {m.member_name || m.name || m.email}
            </option>
          ))}
        </select>
      </div>
    )}

    {expApprovalError && <p className="text-sm text-red-500">{expApprovalError}</p>}
    {expApprovalSaved && <p className="text-sm text-emerald-500">{expApprovalSaved}</p>}

    <button
      onClick={async () => {
        setExpApprovalLoading(true); setExpApprovalError(''); setExpApprovalSaved('');
        try {
          const r = await fetch('/api/expense-approval-settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: expApprovalEnabled, approverUserId: expApprovalApprover || null }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setExpApprovalSaved('Expense approval settings saved');
        } catch (e: unknown) { setExpApprovalError(e instanceof Error ? e.message : 'Failed'); }
        finally { setExpApprovalLoading(false); }
      }}
      disabled={expApprovalLoading}
      className="px-6 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
    >
      {expApprovalLoading ? 'Saving…' : 'Save Expense Approval'}
    </button>
  </div>
</div>
```

**Step 4: Add PO per-staff mapping UI section** — after the expense approval section:

```tsx
{/* ── Per-Staff PO Approver Mapping ───────────────────── */}
<div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.07]">
  <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">
    Per-Staff PO Approvers
  </h3>
  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
    Override the default PO approver for specific team members.
  </p>

  <div className="flex flex-wrap gap-3 mb-4">
    <select
      value={poMappingStaff}
      onChange={e => setPoMappingStaff(e.target.value)}
      className="flex-1 min-w-[160px] px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="">— Staff member —</option>
      {teamMembers.map((m: any) => (
        <option key={m.member_user_id || m.id} value={m.member_user_id || m.id}>
          {m.member_name || m.name || m.email}
        </option>
      ))}
    </select>
    <select
      value={poMappingApprover}
      onChange={e => setPoMappingApprover(e.target.value)}
      className="flex-1 min-w-[160px] px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="">— Approver —</option>
      {teamMembers.map((m: any) => (
        <option key={m.member_user_id || m.id} value={m.member_user_id || m.id}>
          {m.member_name || m.name || m.email}
        </option>
      ))}
    </select>
    <button
      onClick={async () => {
        if (!poMappingStaff || !poMappingApprover) return;
        setPoMappingLoading(true); setPoMappingError('');
        try {
          const r = await fetch('/api/po/approver-mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffUserId: poMappingStaff, approverUserId: poMappingApprover }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setPoMappings(prev => {
            const idx = prev.findIndex(m => m.staff_user_id === poMappingStaff);
            if (idx >= 0) { const next = [...prev]; next[idx] = d.mapping; return next; }
            return [...prev, d.mapping];
          });
          setPoMappingStaff(''); setPoMappingApprover('');
        } catch (e: unknown) { setPoMappingError(e instanceof Error ? e.message : 'Failed'); }
        finally { setPoMappingLoading(false); }
      }}
      disabled={poMappingLoading || !poMappingStaff || !poMappingApprover}
      className="shrink-0 px-6 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
    >
      Add Mapping
    </button>
  </div>

  {poMappingError && <p className="text-sm text-red-500 mb-3">{poMappingError}</p>}

  {poMappings.length > 0 && (
    <div className="space-y-2">
      {poMappings.map(m => (
        <div key={m.staff_user_id} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/[0.07]">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">{m.staff_name}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span>{m.approver_name}</span>
          </div>
          <button
            onClick={async () => {
              try {
                const r = await fetch(`/api/po/approver-mappings/${m.staff_user_id}`, { method: 'DELETE' });
                if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
                setPoMappings(prev => prev.filter(x => x.staff_user_id !== m.staff_user_id));
              } catch (e: unknown) { setPoMappingError(e instanceof Error ? e.message : 'Failed'); }
            }}
            className="text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

Note: `teamMembers` is the existing array loaded by the PO settings section. Read the SettingsForm to confirm the exact variable name before inserting.

**Step 5: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 7: Expenses Page — Pending Approval UI

**Files:**
- Modify: `app/dashboard/expenses/page.tsx`

**Step 1: Add pending approval state and load function**

At the top of the component, after existing state declarations, add:

```typescript
const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
const [pendingMileage, setPendingMileage] = useState<any[]>([]);
const [approvalActionLoading, setApprovalActionLoading] = useState<string | null>(null);
const [rejectModal, setRejectModal] = useState<{ id: string; type: 'expense' | 'mileage' } | null>(null);
const [rejectReason, setRejectReason] = useState('');

const loadPendingApprovals = useCallback(async () => {
  try {
    const r = await fetch('/api/expense-approval-settings/pending');
    if (r.ok) {
      const { expenses, mileage } = await r.json();
      setPendingExpenses(expenses || []);
      setPendingMileage(mileage || []);
    }
  } catch { /* not an approver, ignore */ }
}, []);
```

**Step 2: Call loadPendingApprovals in useEffect** — add `loadPendingApprovals()` call alongside the existing load calls.

**Step 3: Add "Needs Approval" section** — render this at the top of the page content (above the tabs), but only if `pendingExpenses.length + pendingMileage.length > 0`:

```tsx
{(pendingExpenses.length > 0 || pendingMileage.length > 0) && (
  <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-[2rem] p-6">
    <h3 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-4">
      Needs Your Approval ({pendingExpenses.length + pendingMileage.length})
    </h3>
    <div className="space-y-2">
      {[
        ...pendingExpenses.map(e => ({ ...e, _type: 'expense' as const })),
        ...pendingMileage.map(m => ({ ...m, _type: 'mileage' as const })),
      ].map(item => (
        <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-white/5 rounded-xl border border-amber-100 dark:border-white/[0.07]">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{item.description}</p>
            <p className="text-xs text-slate-500">
              {item.submitter_name} · {item._type === 'expense' ? `£${parseFloat(item.gross_amount).toFixed(2)}` : `£${parseFloat(item.amount).toFixed(2)}`} · {item.date}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              disabled={approvalActionLoading === item.id}
              onClick={async () => {
                setApprovalActionLoading(item.id);
                try {
                  const endpoint = item._type === 'expense'
                    ? `/api/expenses/${item.id}/approve`
                    : `/api/mileage/${item.id}/approve`;
                  const r = await fetch(endpoint, { method: 'POST' });
                  if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
                  loadPendingApprovals();
                } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
                finally { setApprovalActionLoading(null); }
              }}
              className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-black rounded-lg text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
            >
              Approve
            </button>
            <button
              disabled={approvalActionLoading === item.id}
              onClick={() => { setRejectModal({ id: item.id, type: item._type }); setRejectReason(''); }}
              className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-black rounded-lg text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 4: Add reject modal** — render before the closing `</main>` or `</div>`:

```tsx
{rejectModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 dark:border-white/[0.07]">
      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-4">Reject — provide a reason</h4>
      <textarea
        value={rejectReason}
        onChange={e => setRejectReason(e.target.value)}
        rows={3}
        placeholder="e.g. Missing receipt, incorrect category…"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 resize-none"
      />
      <div className="flex gap-3">
        <button
          onClick={async () => {
            if (!rejectReason.trim()) return;
            setApprovalActionLoading(rejectModal.id);
            try {
              const endpoint = rejectModal.type === 'expense'
                ? `/api/expenses/${rejectModal.id}/reject`
                : `/api/mileage/${rejectModal.id}/reject`;
              const r = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectReason }),
              });
              if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
              setRejectModal(null);
              loadPendingApprovals();
            } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
            finally { setApprovalActionLoading(null); }
          }}
          disabled={!rejectReason.trim() || approvalActionLoading === rejectModal.id}
          className="flex-1 px-4 py-3 bg-red-500 text-white font-black rounded-xl text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
        >
          Reject
        </button>
        <button
          onClick={() => setRejectModal(null)}
          className="flex-1 px-4 py-3 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-black rounded-xl text-sm uppercase tracking-widest hover:brightness-110 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 5: Also update the status badge rendering** in the existing expense list to show `pending_approval` and `rejected` statuses with appropriate colours. Find where `status === 'pending'` badge is rendered and add:

```tsx
// Add these cases to however status badges are rendered:
// pending_approval → amber badge "Pending Approval"
// rejected → red badge "Rejected"
// approved → blue/teal badge "Approved"
```

**Step 6: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 8: 24h PO Escalation Cron

**Files:**
- Create: `app/api/cron/po-escalation/route.ts`
- Modify: `docker-compose.yml`

**Step 1: Create the escalation API endpoint**

```typescript
// app/api/cron/po-escalation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPOApprovalRequestEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    // Find POs pending approval for >24h without escalation yet sent
    const r = await query(
      `SELECT po.*, u.email AS approver_email, u.full_name AS approver_name,
              req.full_name AS requester_name
       FROM purchase_orders po
       JOIN po_settings ps ON ps.entity_id = po.entity_id AND ps.enabled = true
       LEFT JOIN po_approver_mappings pam ON pam.entity_id = po.entity_id AND pam.staff_user_id = po.requested_by_id
       JOIN users u ON u.id = COALESCE(pam.approver_user_id, ps.approver_user_id)
       JOIN users req ON req.id = po.requested_by_id
       WHERE po.status = 'pending_approval'
         AND po.created_at < NOW() - INTERVAL '24 hours'
         AND po.escalation_sent_at IS NULL`,
      []
    );

    let escalated = 0;
    for (const po of r.rows) {
      try {
        await sendPOApprovalRequestEmail({
          recipientEmail: po.approver_email,
          recipientName: po.approver_name,
          requesterName: po.requester_name,
          po,
          approveUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/po/approve-link?token=${po.approval_token}&action=approve`,
          rejectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/po/approve-link?token=${po.approval_token}&action=reject`,
          isEscalation: true,
        });
        await query(
          `UPDATE purchase_orders SET escalation_sent_at = NOW() WHERE id = $1`,
          [po.id]
        );
        escalated++;
      } catch (e) {
        console.error(`[ESCALATION] Failed to send for PO ${po.id}:`, e);
      }
    }

    return NextResponse.json({ escalated, checked: r.rows.length });
  } catch (e) {
    console.error('PO escalation cron error:', e);
    return NextResponse.json({ error: 'Escalation failed' }, { status: 500 });
  }
}
```

**Step 2: Update sendPOApprovalRequestEmail signature to accept isEscalation flag**

Read `lib/email.ts` around the `sendPOApprovalRequestEmail` function. Add optional `isEscalation?: boolean` to the params interface and update the subject line:

```typescript
subject: params.isEscalation
  ? `⚠️ REMINDER: PO awaiting approval for 24h — ${po.po_number}`
  : `PO approval required — ${po.po_number}`,
```

**Step 3: Update docker-compose.yml cron command** to also call the escalation endpoint:

```yaml
command: >
  sh -c "while true; do
    wget -qO- --header=\"Authorization: Bearer $$CRON_SECRET\" http://web:3000/api/cron/reminders || true;
    wget -qO- --header=\"Authorization: Bearer $$CRON_SECRET\" http://web:3000/api/cron/po-escalation || true;
    sleep 3600;
  done"
```

**Step 4: Verify TypeScript**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 9: Deploy and Verify

**Step 1: Apply migration**

```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-accounts/database/migrations/019_approval_workflows.sql
```

Verify:
```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d po_approver_mappings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d expense_approval_settings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d expenses" | grep -E "approved|rejected"
```

**Step 2: Final TypeScript check**

```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

Expected: zero errors.

**Step 3: Build and deploy**

```bash
cd /opt/relentify-accounts
docker compose down
docker compose build --no-cache 2>&1 | tail -20
docker compose up -d
docker logs relentify-accounts --tail 30
```

Expected: `✓ Ready in Xms` — no startup errors.

**Step 4: Smoke test**

1. Log in as workspace owner → Settings → Purchase Orders tab: verify "Expense & Mileage Approval" section appears and saves
2. Verify "Per-Staff PO Approvers" section appears and can add/remove mappings
3. Go to Expenses page as a team member — submit an expense with a date that's not locked → verify status shows "Pending Approval"
4. Log in as the configured approver → Expenses page → verify "Needs Approval" amber panel appears
5. Click Approve → verify expense status changes to "Approved", no GL error in docker logs
6. Submit another expense → click Reject → enter reason → verify status changes to "Rejected"
7. Check cron logs: `docker logs relentify-accounts-cron-1 --tail 20` — verify escalation call appears

**Step 5: Cleanup**

```bash
docker builder prune -f
```

**Step 6: Update CLAUDE.md** — mark items #31 and #15 as ✅, update summary count.

---

## Key Implementation Notes

- **Approval bypass**: If `expense_approval_settings.enabled = false`, expenses post GL immediately at creation (existing behaviour unchanged).
- **Mileage status**: Mileage claims don't have a `status` column — we use `approved_at IS NULL AND rejected_at IS NULL` to determine pending state.
- **PO approver resolution order**: `po_approver_mappings` (per-staff) → `po_settings.approver_user_id` (entity-wide) → null (no approver, PO auto-approved or blocked depending on settings.enabled).
- **GL idempotency**: The `journal_entries` table has `(source_type, source_id)` as the logical key — if approval is called twice, the second GL post will create a duplicate entry. The approve endpoint should be idempotent — check that `approved_at IS NULL` before posting GL (already handled by the `status = 'pending_approval'` guard in `approveExpense`).
- **teamMembers variable**: The PO settings section already loads team members into a state variable. Re-use it for the expense approval approver dropdown. Read the existing SettingsForm code to confirm the variable name before inserting JSX.
