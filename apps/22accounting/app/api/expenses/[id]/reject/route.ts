import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getExpenseApprovalSettings, rejectExpense } from '@/src/lib/expense_approval.service';
import { sendExpenseDecisionEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';
import { logAudit } from '@/src/lib/audit.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'expenses', 'approve');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const approvalSettings = await getExpenseApprovalSettings(entity.id);
    if (!approvalSettings?.enabled || approvalSettings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to reject expenses' }, { status: 403 });
    }

    const { reason } = await req.json();
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const ok = await rejectExpense(id, auth.userId, reason.trim());
    if (!ok) {
      return NextResponse.json({ error: 'Expense not found or not pending approval' }, { status: 404 });
    }

    await logAudit(auth.userId, 'reject', 'expense', id, { reason });

    // Notify claimant
    const expRow = await query(`SELECT e.*, u.email, u.full_name FROM expenses e JOIN users u ON e.user_id = u.id WHERE e.id = $1`, [id]);
    const exp = expRow.rows[0];
    const approverRow = await query(`SELECT full_name FROM users WHERE id = $1`, [auth.userId]);
    if (exp?.email) {
      await sendExpenseDecisionEmail({
        to: exp.email,
        claimerName: exp.full_name,
        description: exp.description,
        amount: parseFloat(exp.gross_amount),
        decision: 'rejected',
        approverName: approverRow.rows[0]?.full_name || 'Your approver',
        type: 'expense',
        rejectionReason: reason.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST expense/reject error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
