# Approval Workflows — Part 2: UI + Cron + Deploy

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Settings UI (expense approval + PO per-staff mapping), Expenses page pending approvals panel, 24h PO escalation cron, then deploy.

**Prerequisite:** Part 1 must be complete (`docs/plans/2026-03-10-approval-workflows-part1.md`). Migration 019 applied. All services and API routes exist.

**What Part 1 created:**
- `lib/services/po_approver_mapping.service.ts` — `getPOApproverMappings`, `upsertPOApproverMapping`, `deletePOApproverMapping`
- `lib/services/expense_approval.service.ts` — `getExpenseApprovalSettings`, `upsertExpenseApprovalSettings`, approve/reject/pending functions
- API routes: `GET/POST /api/po/approver-mappings`, `DELETE /api/po/approver-mappings/[staffId]`
- API routes: `POST /api/expenses/[id]/approve`, `POST /api/expenses/[id]/reject`, same for mileage
- API routes: `GET/PATCH /api/expense-approval-settings`, `GET /api/expense-approval-settings/pending`
- Email: `sendExpenseApprovalRequestEmail`, `sendExpenseDecisionEmail` in `lib/email.ts`

**Codebase patterns to follow:**
- Auth: `getAuthUser()` → JWT; `getActiveEntity(auth.userId)` for entity; `getUserById(auth.userId)` for tier
- Tier gating: `canAccess(user?.tier, 'feature')` from `lib/tiers.ts`
- Settings page: `app/dashboard/settings/SettingsForm.tsx` — client component, tabs: `business | account | stripe | accountant | po | locks`
- The `po` tab already has PO settings (enabled toggle, approver dropdown, threshold). `teamMembers` state is loaded there — read the file to find the exact variable name before inserting JSX.
- Expenses page: `app/dashboard/expenses/page.tsx` — client component, tabs: `expenses | mileage`

---

## Task 6: Settings UI — Expense Approval + PO Per-Staff Mapping

**Files:** Modify `app/dashboard/settings/SettingsForm.tsx`

**Step 1: Read the file** — read `app/dashboard/settings/SettingsForm.tsx` to understand:
- The exact state variable name for team members (e.g. `teamMembers`)
- Where the PO settings section ends (the Save PO Settings button)
- The total line count so you know where to insert

**Step 2: Add state variables** after the existing PO state block:

```typescript
// Expense approval
const [expApprovalEnabled, setExpApprovalEnabled] = useState(false);
const [expApprovalApprover, setExpApprovalApprover] = useState('');
const [expApprovalSaved, setExpApprovalSaved] = useState('');
const [expApprovalError, setExpApprovalError] = useState('');
const [expApprovalLoading, setExpApprovalLoading] = useState(false);

// PO per-staff mappings
const [poMappings, setPoMappings] = useState<Array<{
  id: string; staff_user_id: string; staff_name: string;
  approver_user_id: string; approver_name: string;
}>>([]);
const [poMappingStaff, setPoMappingStaff] = useState('');
const [poMappingApprover, setPoMappingApprover] = useState('');
const [poMappingLoading, setPoMappingLoading] = useState(false);
const [poMappingError, setPoMappingError] = useState('');
```

**Step 3: Add data loading** — find the existing `useEffect` or load function that calls `/api/po/settings`. Add these calls inside the same function, alongside the existing PO settings load:

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

**Step 4: Insert JSX — Expense Approval section**

Find the Save PO Settings button in the `po` tab JSX. After that button (still inside the `activeTab === 'po'` panel), insert:

```tsx
{/* ── Expense & Mileage Approval ─────────────────── */}
<div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.07]">
  <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
    Expense &amp; Mileage Approval
  </h3>
  <div className="space-y-4">
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={expApprovalEnabled}
        onChange={e => setExpApprovalEnabled(e.target.checked)}
        className="w-4 h-4 rounded accent-emerald-500"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">Require approval before expenses post to the ledger</span>
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
          {/* Use the exact teamMembers variable name from the file */}
          {teamMembers.map((m: any) => (
            <option key={m.member_user_id || m.id} value={m.member_user_id || m.id}>
              {m.member_name || m.full_name || m.email}
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
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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

**Step 5: Insert JSX — Per-Staff PO Approvers section** (immediately after the expense approval section above):

```tsx
{/* ── Per-Staff PO Approvers ───────────────────────── */}
<div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.07]">
  <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
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
          {m.member_name || m.full_name || m.email}
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
          {m.member_name || m.full_name || m.email}
        </option>
      ))}
    </select>
    <button
      onClick={async () => {
        if (!poMappingStaff || !poMappingApprover) return;
        setPoMappingLoading(true); setPoMappingError('');
        try {
          const r = await fetch('/api/po/approver-mappings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffUserId: poMappingStaff, approverUserId: poMappingApprover }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setPoMappings(prev => {
            const idx = prev.findIndex(x => x.staff_user_id === poMappingStaff);
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
      Add
    </button>
  </div>

  {poMappingError && <p className="text-sm text-red-500 mb-3">{poMappingError}</p>}

  {poMappings.length > 0 && (
    <div className="space-y-2">
      {poMappings.map(m => (
        <div key={m.staff_user_id} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/[0.07]">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">{m.staff_name}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span>{m.approver_name}</span>
          </p>
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

**Step 6: TypeScript check**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 7: Expenses Page — Pending Approval Panel

**Files:** Modify `app/dashboard/expenses/page.tsx`

**Step 1: Read the file** to understand current state structure, existing `useEffect`, and where to insert the panel in the JSX (before the tabs, after the page header).

**Step 2: Add state + load function** after existing state declarations:

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
      const data = await r.json();
      setPendingExpenses(data.expenses || []);
      setPendingMileage(data.mileage || []);
    }
  } catch { /* not an approver */ }
}, []);
```

**Step 3: Call in useEffect** — add `loadPendingApprovals()` to the existing useEffect alongside other load calls.

**Step 4: Update the `Expense` type** at top of file to include new statuses:

```typescript
type Expense = {
  // ... existing fields ...
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'reimbursed';
  approved_by_id?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
};
```

**Step 5: Add "Needs Approval" panel** — insert before the existing tab buttons (find where `<div` or the tab bar starts and insert above it):

```tsx
{(pendingExpenses.length > 0 || pendingMileage.length > 0) && (
  <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-[2rem] p-6">
    <h3 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-4">
      Needs Your Approval ({pendingExpenses.length + pendingMileage.length})
    </h3>
    <div className="space-y-2">
      {[
        ...pendingExpenses.map(e => ({ ...e, _type: 'expense' as const, _amount: e.gross_amount })),
        ...pendingMileage.map(m => ({ ...m, _type: 'mileage' as const, _amount: m.amount })),
      ].map(item => (
        <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-white/5 rounded-xl border border-amber-100 dark:border-white/[0.07]">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{item.description}</p>
            <p className="text-xs text-slate-500">
              {item.submitter_name} · £{parseFloat(item._amount).toFixed(2)} · {item.date}
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
              {approvalActionLoading === item.id ? '…' : 'Approve'}
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

**Step 6: Add reject modal** — insert just before the closing `</main>` (or outermost closing `</div>`):

```tsx
{rejectModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 dark:border-white/[0.07]">
      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-4">Provide rejection reason</h4>
      <textarea
        value={rejectReason}
        onChange={e => setRejectReason(e.target.value)}
        rows={3}
        placeholder="e.g. Missing receipt, wrong category…"
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
                method: 'POST', headers: { 'Content-Type': 'application/json' },
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

**Step 7: Update status badge rendering** — find where the expense status badge is rendered (look for `status === 'pending'` or similar). Add cases for new statuses:

```tsx
// Wherever status is displayed, add:
status === 'pending_approval' ? <span className="...amber badge...">Pending Approval</span>
  : status === 'approved' ? <span className="...blue/teal badge...">Approved</span>
  : status === 'rejected' ? <span className="...red badge...">Rejected</span>
  : // existing cases
```

Match the exact badge styling from existing `status === 'pending'` and `status === 'reimbursed'` badges.

**Step 8: TypeScript check**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 8: 24h PO Escalation Cron

**Files:**
- Create: `app/api/cron/po-escalation/route.ts`
- Modify: `docker-compose.yml`

**Step 1: Read `lib/email.ts`** to confirm the exact signature of `sendPOApprovalRequestEmail` (parameter names). Then check if it accepts an `isEscalation` flag — it likely doesn't. We'll pass a custom subject via a wrapper.

**Step 2: Create `app/api/cron/po-escalation/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPOApprovalRequestEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  try {
    // POs pending >24h with no escalation sent yet
    const r = await query(
      `SELECT po.*,
              COALESCE(pam.approver_user_id, ps.approver_user_id) AS resolved_approver_id,
              u.email AS approver_email, u.full_name AS approver_name,
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
        // Send using the existing email function — read its signature and pass correct params
        await sendPOApprovalRequestEmail({
          recipientEmail: po.approver_email,
          recipientName: po.approver_name,
          requesterName: po.requester_name,
          po,
          approveUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/po/approve-link?token=${po.approval_token}&action=approve`,
          rejectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/po/approve-link?token=${po.approval_token}&action=reject`,
        });
        await query(`UPDATE purchase_orders SET escalation_sent_at = NOW() WHERE id = $1`, [po.id]);
        escalated++;
      } catch (e) {
        console.error(`[PO ESCALATION] Failed for PO ${po.id}:`, e);
      }
    }

    return NextResponse.json({ escalated, checked: r.rows.length });
  } catch (e) {
    console.error('PO escalation cron error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Important:** Before writing, read `lib/email.ts` to find the exact parameter names for `sendPOApprovalRequestEmail` and match them exactly.

**Step 3: Update `docker-compose.yml`** cron command — add the escalation call:

Read the file first. Find the `command:` block under the `cron:` service. It currently calls `/api/cron/reminders`. Add the escalation call on the next line:

```yaml
command: >
  sh -c "while true; do
    wget -qO- --header=\"Authorization: Bearer $$CRON_SECRET\" http://web:3000/api/cron/reminders || true;
    wget -qO- --header=\"Authorization: Bearer $$CRON_SECRET\" http://web:3000/api/cron/po-escalation || true;
    sleep 3600;
  done"
```

**Step 4: TypeScript check**
```bash
cd /opt/relentify-accounts && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "Cannot find module"
```

---

## Task 9: Deploy and Verify

**Step 1: Build and start**

```bash
cd /opt/relentify-accounts
docker compose down
docker compose build --no-cache 2>&1 | tail -20
docker compose up -d
docker logs relentify-accounts --tail 30
```

Expected: `✓ Ready in Xms` — no startup errors.

**Step 2: Smoke test checklist**

1. Settings → Purchase Orders tab → verify "Expense & Mileage Approval" section visible, toggle + approver dropdown + save works
2. Settings → PO tab → "Per-Staff PO Approvers" section → add a mapping → appears in list → remove it
3. Submit an expense as a team member → verify status shows "Pending Approval" in expense list
4. Log in as the configured expense approver → Expenses page → amber "Needs Approval" panel visible
5. Click Approve → verify panel item disappears, expense status → "Approved", no GL error in `docker logs relentify-accounts --tail 20`
6. Submit another expense → Reject → enter reason → verify status → "Rejected"
7. Check cron: `docker logs relentify-accounts-cron-1 --tail 20` — escalation URL call appears

**Step 3: Cleanup**
```bash
docker builder prune -f
```

**Step 4: Update CLAUDE.md**

Mark items #31 and #15 as ✅ in the checklist. Update summary count from `24 done | 24 remaining` to `26 done | 22 remaining`.

Add to the completed list:
```
| 15 | Expense/mileage approval — pending_approval status machine, GL posts on approval, approve/reject API + email, "Needs Approval" panel on expenses page. |
| 31 | PO approval mapping — po_approver_mappings table, per-staff approver routing, Settings UI, 24h escalation cron. Migration 019. |
```
