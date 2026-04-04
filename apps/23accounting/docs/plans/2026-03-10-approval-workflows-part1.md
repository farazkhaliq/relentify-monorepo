# Approval Workflows — Part 1: Backend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** DB migration + all backend services + API routes + email for PO per-staff approver mapping (#31) and expense/mileage approval workflow (#15).

**Architecture:** New `po_approver_mappings` table for per-staff PO routing (falls back to `po_settings.approver_user_id`). New `expense_approval_settings` + approval columns on `expenses`/`mileage_claims`. GL posts on approval (not creation) when approval enabled. Part 2 handles UI.

**What already exists:** Full PO approval flow (`po_settings`, tokens, approve/reject API, `sendPOApprovalRequestEmail`/`sendPODecisionEmail` in `lib/email.ts`). Expenses have no approval — status is `'pending' | 'reimbursed'`, GL posts at creation. Auth: `getAuthUser()` → JWT only; call `getActiveEntity(auth.userId)` + `getUserById(auth.userId)` separately. Latest migration: 018.

**After Part 1 is done, run Part 2** (`docs/plans/2026-03-10-approval-workflows-part2.md`).

---

## Task 1: Migration 019

**Files:** Create `database/migrations/019_approval_workflows.sql`

```sql
-- 019_approval_workflows.sql
CREATE TABLE po_approver_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, staff_user_id)
);
CREATE INDEX idx_po_approver_mappings_entity ON po_approver_mappings(entity_id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS escalation_sent_at TIMESTAMPTZ;

CREATE TABLE expense_approval_settings (
  entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE mileage_claims
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
```

Apply:
```bash
docker exec -i infra-postgres psql -U relentify_user -d relentify < /opt/relentify-accounts/database/migrations/019_approval_workflows.sql
```

Verify:
```bash
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d po_approver_mappings"
docker exec -it infra-postgres psql -U relentify_user -d relentify -c "\d expenses" | grep approved
```

---

## Task 2: PO Approver Mapping Service

**Files:**
- Create: `lib/services/po_approver_mapping.service.ts`
- Modify: `lib/services/po.service.ts`

**Step 1: Create `lib/services/po_approver_mapping.service.ts`**

```typescript
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

export async function getPOApproverMappings(entityId: string): Promise<POApproverMapping[]> {
  const r = await query(
    `SELECT m.*, s.full_name AS staff_name, a.full_name AS approver_name
     FROM po_approver_mappings m
     JOIN users s ON s.id = m.staff_user_id
     JOIN users a ON a.id = m.approver_user_id
     WHERE m.entity_id = $1 ORDER BY s.full_name ASC`,
    [entityId]
  );
  return r.rows;
}

export async function upsertPOApproverMapping(
  entityId: string, staffUserId: string, approverUserId: string
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

export async function deletePOApproverMapping(entityId: string, staffUserId: string): Promise<void> {
  await query(
    `DELETE FROM po_approver_mappings WHERE entity_id = $1 AND staff_user_id = $2`,
    [entityId, staffUserId]
  );
}

/** Per-staff mapping first, falls back to po_settings entity-wide approver */
export async function resolveApproverForStaff(
  entityId: string, staffUserId: string
): Promise<string | null> {
  const mapRes = await query(
    `SELECT approver_user_id FROM po_approver_mappings WHERE entity_id = $1 AND staff_user_id = $2`,
    [entityId, staffUserId]
  );
  if (mapRes.rows[0]?.approver_user_id) return mapRes.rows[0].approver_user_id;

  const settingsRes = await query(
    `SELECT approver_user_id FROM po_settings WHERE entity_id = $1 AND enabled = true`,
    [entityId]
  );
  return settingsRes.rows[0]?.approver_user_id ?? null;
}
```

**Step 2: Update `lib/services/po.service.ts`**

Read the file. Find where PO creation resolves the approver (look for `getPOSettings` or `approver_user_id` near PO insert). Replace the approver lookup with:

```typescript
import { resolveApproverForStaff } from './po_approver_mapping.service';
// ...
const approverId = await resolveApproverForStaff(entityId, requestedById);
```

**Step 3: TypeScript check**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 3: PO Approver Mappings API Routes

**Files:**
- Create: `app/api/po/approver-mappings/route.ts`
- Create: `app/api/po/approver-mappings/[staffId]/route.ts`

**`app/api/po/approver-mappings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { getPOApproverMappings, upsertPOApproverMapping } from '@/lib/services/po_approver_mapping.service';
import { logAudit } from '@/lib/services/audit.service';

async function authCheck() {
  const auth = await getAuthUser();
  if (!auth) return null;
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return null;
  const user = await getUserById(auth.userId);
  if (!canAccess(user?.tier, 'po_approvals')) return null;
  return { auth, entity, user };
}

export async function GET() {
  try {
    const ctx = await authCheck();
    if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const mappings = await getPOApproverMappings(ctx.entity.id);
    return NextResponse.json({ mappings });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await authCheck();
    if (!ctx) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { staffUserId, approverUserId } = await req.json();
    if (!staffUserId || !approverUserId) return NextResponse.json({ error: 'staffUserId and approverUserId required' }, { status: 400 });
    const mapping = await upsertPOApproverMapping(ctx.entity.id, staffUserId, approverUserId);
    await logAudit(ctx.auth.userId, 'upsert', 'po_approver_mapping', mapping.id, { staffUserId, approverUserId });
    return NextResponse.json({ mapping });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/po/approver-mappings/[staffId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { canAccess } from '@/lib/tiers';
import { deletePOApproverMapping } from '@/lib/services/po_approver_mapping.service';
import { logAudit } from '@/lib/services/audit.service';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    const { staffId } = await params;
    await deletePOApproverMapping(entity.id, staffId);
    await logAudit(auth.userId, 'delete', 'po_approver_mapping', staffId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**TypeScript check:**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 4: Expense Approval Service + Email

**Files:**
- Create: `lib/services/expense_approval.service.ts`
- Modify: `lib/services/expense.service.ts`
- Modify: `lib/email.ts`

**Step 1: Create `lib/services/expense_approval.service.ts`**

```typescript
import { query } from '../db';

export interface ExpenseApprovalSettings {
  entity_id: string;
  enabled: boolean;
  approver_user_id: string | null;
}

export async function getExpenseApprovalSettings(entityId: string): Promise<ExpenseApprovalSettings | null> {
  const r = await query(`SELECT * FROM expense_approval_settings WHERE entity_id = $1`, [entityId]);
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

export async function approveExpense(id: string, entityId: string, approverId: string) {
  // Scope: expense must belong to entity owner or a workspace member
  const r = await query(
    `UPDATE expenses SET status = 'approved', approved_by_id = $3, approved_at = NOW()
     WHERE id = $1 AND status = 'pending_approval'
       AND user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $2
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $2 AND wm.status = 'active'
       )
     RETURNING *`,
    [id, entityId, approverId]
  );
  return r.rows[0] ?? null;
}

export async function rejectExpense(id: string, entityId: string, approverId: string, reason: string) {
  const r = await query(
    `UPDATE expenses SET status = 'rejected', approved_by_id = $3, rejected_at = NOW(), rejection_reason = $4
     WHERE id = $1 AND status = 'pending_approval'
       AND user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $2
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $2 AND wm.status = 'active'
       )
     RETURNING *`,
    [id, entityId, approverId, reason]
  );
  return r.rows[0] ?? null;
}

export async function approveMileage(id: string, entityId: string, approverId: string) {
  const r = await query(
    `UPDATE mileage_claims SET approved_by_id = $3, approved_at = NOW()
     WHERE id = $1 AND approved_at IS NULL AND rejected_at IS NULL
       AND user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $2
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $2 AND wm.status = 'active'
       )
     RETURNING *`,
    [id, entityId, approverId]
  );
  return r.rows[0] ?? null;
}

export async function rejectMileage(id: string, entityId: string, approverId: string, reason: string) {
  const r = await query(
    `UPDATE mileage_claims SET approved_by_id = $3, rejected_at = NOW(), rejection_reason = $4
     WHERE id = $1 AND approved_at IS NULL AND rejected_at IS NULL
       AND user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $2
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $2 AND wm.status = 'active'
       )
     RETURNING *`,
    [id, entityId, approverId, reason]
  );
  return r.rows[0] ?? null;
}

export async function getPendingExpensesForApprover(entityId: string, approverUserId: string) {
  const r = await query(
    `SELECT e.*, u.full_name AS submitter_name
     FROM expenses e
     JOIN users u ON u.id = e.user_id
     WHERE e.status = 'pending_approval'
       AND EXISTS (
         SELECT 1 FROM expense_approval_settings eas
         WHERE eas.entity_id = $1 AND eas.approver_user_id = $2 AND eas.enabled = true
       )
       AND e.user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $1
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $1 AND wm.status = 'active'
       )
     ORDER BY e.date DESC`,
    [entityId, approverUserId]
  );
  return r.rows;
}

export async function getPendingMileageForApprover(entityId: string, approverUserId: string) {
  const r = await query(
    `SELECT m.*, u.full_name AS submitter_name
     FROM mileage_claims m
     JOIN users u ON u.id = m.user_id
     WHERE m.approved_at IS NULL AND m.rejected_at IS NULL
       AND EXISTS (
         SELECT 1 FROM expense_approval_settings eas
         WHERE eas.entity_id = $1 AND eas.approver_user_id = $2 AND eas.enabled = true
       )
       AND m.user_id IN (
         SELECT en.user_id FROM entities en WHERE en.id = $1
         UNION
         SELECT wm.member_user_id FROM workspace_members wm
         JOIN entities en2 ON en2.user_id = wm.owner_user_id WHERE en2.id = $1 AND wm.status = 'active'
       )
     ORDER BY m.date DESC`,
    [entityId, approverUserId]
  );
  return r.rows;
}
```

**Step 2: Update `lib/services/expense.service.ts`**

Read the file first. Make these targeted changes:

1. Update `Expense` interface status union:
```typescript
status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'reimbursed';
```

2. In `createExpense`, before the INSERT, add approval check and conditionally skip GL:
```typescript
// Determine status and whether GL posts now or on approval
let status = 'pending';
if (data.entityId) {
  const { getExpenseApprovalSettings } = await import('./expense_approval.service');
  const approvalSettings = await getExpenseApprovalSettings(data.entityId);
  if (approvalSettings?.enabled && approvalSettings.approver_user_id) {
    status = 'pending_approval';
  }
}
```

Add `status` to the INSERT (add `$9` param for status, add `, status` to the column list and `, $9` to VALUES).

Wrap the existing GL posting block so it only fires when `status !== 'pending_approval'`:
```typescript
if (status !== 'pending_approval' && data.entityId) {
  try {
    // ... existing GL code unchanged ...
  } catch (_glErr) { ... }
}
```

3. Update `markExpenseReimbursed` WHERE clause:
```typescript
WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'approved')
```

**Step 3: Add email functions to `lib/email.ts`**

Read `lib/email.ts` to find the style constant name used in other email functions (likely `EMAIL_BASE_STYLE` or similar). Append at end of file:

```typescript
// ─── Expense Approval Emails ─────────────────────────────────────────────────

export async function sendExpenseApprovalRequestEmail(params: {
  recipientEmail: string;
  recipientName: string;
  submitterName: string;
  description: string;
  amount: string;
  date: string;
  appUrl: string;
}) {
  const { recipientEmail, recipientName, submitterName, description, amount, date, appUrl } = params;
  await resend.emails.send({
    from: 'invoices@relentify.com',
    to: recipientEmail,
    subject: `Expense pending approval — ${description}`,
    html: `${EMAIL_BASE_STYLE /* use the actual constant name from the file */}
      <div class="card">
        <div class="header">Expense Approval Required</div>
        <p>Hi ${recipientName},</p>
        <p><strong>${submitterName}</strong> has submitted an expense for your approval.</p>
        <div class="row"><span class="lbl">Description</span><span class="val">${description}</span></div>
        <div class="row"><span class="lbl">Amount</span><span class="val">${amount}</span></div>
        <div class="row"><span class="lbl">Date</span><span class="val">${date}</span></div>
        <div style="text-align:center;margin-top:28px;"><a href="${appUrl}" class="btn">Review Expense</a></div>
      </div>`,
  });
}

export async function sendExpenseDecisionEmail(params: {
  recipientEmail: string;
  recipientName: string;
  approverName: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  description: string;
  amount: string;
}) {
  const { recipientEmail, recipientName, approverName, decision, rejectionReason, description, amount } = params;
  await resend.emails.send({
    from: 'invoices@relentify.com',
    to: recipientEmail,
    subject: `Expense ${decision} — ${description}`,
    html: `${EMAIL_BASE_STYLE /* use actual constant name */}
      <div class="card">
        <div class="header">Expense ${decision === 'approved' ? 'Approved ✓' : 'Rejected'}</div>
        <p>Hi ${recipientName}, your expense was <strong>${decision}</strong> by ${approverName}.</p>
        <div class="row"><span class="lbl">Description</span><span class="val">${description}</span></div>
        <div class="row"><span class="lbl">Amount</span><span class="val">${amount}</span></div>
        ${rejectionReason ? `<div class="row"><span class="lbl">Reason</span><span class="val">${rejectionReason}</span></div>` : ''}
      </div>`,
  });
}
```

**Important:** Before writing, read `lib/email.ts` lines 1–30 to find the exact HTML style constant name and use it.

**Step 4: TypeScript check**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 5: Expense/Mileage Approval API Routes

**Files:**
- Create: `app/api/expenses/[id]/approve/route.ts`
- Create: `app/api/expenses/[id]/reject/route.ts`
- Create: `app/api/mileage/[id]/approve/route.ts`
- Create: `app/api/mileage/[id]/reject/route.ts`
- Create: `app/api/expense-approval-settings/route.ts`
- Create: `app/api/expense-approval-settings/pending/route.ts`

**`app/api/expenses/[id]/approve/route.ts`**

```typescript
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId)
      return NextResponse.json({ error: 'Not authorised to approve expenses' }, { status: 403 });

    const { id } = await params;
    const expense = await approveExpense(id, entity.id, auth.userId);
    if (!expense) return NextResponse.json({ error: 'Not found or not pending' }, { status: 400 });

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
          entityId: entity.id, userId: auth.userId, date: expense.date,
          description: `Expense (approved): ${expense.description}`,
          sourceType: 'expense', sourceId: expense.id, lines: glLines,
        });
      }
    } catch (glErr) { console.error('[GL] Expense approve GL error:', glErr); }

    await logAudit(auth.userId, 'approve', 'expense', id);

    const user = await getUserById(auth.userId);
    const sub = await query(`SELECT email, full_name FROM users WHERE id = $1`, [expense.user_id]);
    const submitter = sub.rows[0];
    if (submitter?.email && submitter.email !== auth.email) {
      sendExpenseDecisionEmail({
        recipientEmail: submitter.email, recipientName: submitter.full_name,
        approverName: user?.full_name || 'Your approver', decision: 'approved',
        description: expense.description, amount: `£${parseFloat(expense.gross_amount).toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Expense approve error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/expenses/[id]/reject/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { rejectExpense, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId)
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

    const { id } = await params;
    const { reason } = await req.json();
    if (!reason?.trim()) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

    const expense = await rejectExpense(id, entity.id, auth.userId, reason);
    if (!expense) return NextResponse.json({ error: 'Not found or not pending' }, { status: 400 });

    await logAudit(auth.userId, 'reject', 'expense', id, { reason });

    const user = await getUserById(auth.userId);
    const row = await query(
      `SELECT u.email, u.full_name, e.gross_amount, e.description
       FROM expenses e JOIN users u ON u.id = e.user_id WHERE e.id = $1`, [id]
    );
    const r = row.rows[0];
    if (r?.email && r.email !== auth.email) {
      sendExpenseDecisionEmail({
        recipientEmail: r.email, recipientName: r.full_name,
        approverName: user?.full_name || 'Your approver', decision: 'rejected',
        rejectionReason: reason, description: r.description,
        amount: `£${parseFloat(r.gross_amount || '0').toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Expense reject error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/mileage/[id]/approve/route.ts`** — same pattern as expense approve but uses `approveMileage` + `buildMileageLines`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { approveMileage, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { postJournalEntry, buildMileageLines } from '@/lib/services/general_ledger.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId)
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

    const { id } = await params;
    const claim = await approveMileage(id, entity.id, auth.userId);
    if (!claim) return NextResponse.json({ error: 'Not found or already actioned' }, { status: 400 });

    try {
      const glLines = await buildMileageLines(entity.id, parseFloat(claim.amount), claim.coa_account_id ?? undefined);
      await postJournalEntry({
        entityId: entity.id, userId: auth.userId, date: claim.date,
        description: `Mileage (approved): ${claim.description}`,
        sourceType: 'mileage', sourceId: claim.id, lines: glLines,
      });
    } catch (glErr) { console.error('[GL] Mileage approve GL error:', glErr); }

    await logAudit(auth.userId, 'approve', 'mileage_claim', id);

    const user = await getUserById(auth.userId);
    const sub = await query(`SELECT email, full_name FROM users WHERE id = $1`, [claim.user_id]);
    const submitter = sub.rows[0];
    if (submitter?.email && submitter.email !== auth.email) {
      sendExpenseDecisionEmail({
        recipientEmail: submitter.email, recipientName: submitter.full_name,
        approverName: user?.full_name || 'Your approver', decision: 'approved',
        description: claim.description, amount: `£${parseFloat(claim.amount).toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Mileage approve error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/mileage/[id]/reject/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getUserById } from '@/lib/services/user.service';
import { rejectMileage, getExpenseApprovalSettings } from '@/lib/services/expense_approval.service';
import { logAudit } from '@/lib/services/audit.service';
import { sendExpenseDecisionEmail } from '@/lib/email';
import { query } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const settings = await getExpenseApprovalSettings(entity.id);
    if (!settings?.enabled || settings.approver_user_id !== auth.userId)
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

    const { id } = await params;
    const { reason } = await req.json();
    if (!reason?.trim()) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

    const claim = await rejectMileage(id, entity.id, auth.userId, reason);
    if (!claim) return NextResponse.json({ error: 'Not found or already actioned' }, { status: 400 });

    await logAudit(auth.userId, 'reject', 'mileage_claim', id, { reason });

    const user = await getUserById(auth.userId);
    const row = await query(
      `SELECT u.email, u.full_name, m.amount, m.description
       FROM mileage_claims m JOIN users u ON u.id = m.user_id WHERE m.id = $1`, [id]
    );
    const r = row.rows[0];
    if (r?.email && r.email !== auth.email) {
      sendExpenseDecisionEmail({
        recipientEmail: r.email, recipientName: r.full_name,
        approverName: user?.full_name || 'Your approver', decision: 'rejected',
        rejectionReason: reason, description: r.description,
        amount: `£${parseFloat(r.amount || '0').toFixed(2)}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Mileage reject error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/expense-approval-settings/route.ts`**

```typescript
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
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    const settings = await getExpenseApprovalSettings(entity.id);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'expenses_mileage')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    const { enabled, approverUserId } = await req.json();
    const settings = await upsertExpenseApprovalSettings(entity.id, { enabled: Boolean(enabled), approverUserId: approverUserId || null });
    await logAudit(auth.userId, 'update', 'expense_approval_settings', entity.id, { enabled, approverUserId });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**`app/api/expense-approval-settings/pending/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getActiveEntity } from '@/lib/services/entity.service';
import { getPendingExpensesForApprover, getPendingMileageForApprover } from '@/lib/services/expense_approval.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ expenses: [], mileage: [] });
    const [expenses, mileage] = await Promise.all([
      getPendingExpensesForApprover(entity.id, auth.userId),
      getPendingMileageForApprover(entity.id, auth.userId),
    ]);
    return NextResponse.json({ expenses, mileage });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Final TypeScript check:**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

Expected: zero errors. If there are errors, read the relevant file and fix them before proceeding.

**Do NOT deploy yet — Part 2 adds the UI. Run Part 2 next.**
