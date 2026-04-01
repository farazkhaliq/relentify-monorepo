import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getExpenseApprovalSettings, approveMileage } from '@/src/lib/expense_approval.service';
import { sendExpenseDecisionEmail } from '@/src/lib/email';
import { query } from '@/src/lib/db';
import { logAudit } from '@/src/lib/audit.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'mileage', 'approve');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const approvalSettings = await getExpenseApprovalSettings(entity.id);
    if (!approvalSettings?.enabled || approvalSettings.approver_user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not authorised to approve mileage claims' }, { status: 403 });
    }

    const ok = await approveMileage(id, auth.userId, entity.id);
    if (!ok) {
      return NextResponse.json({ error: 'Mileage claim not found or not pending approval' }, { status: 404 });
    }

    await logAudit(auth.userId, 'approve', 'mileage_claim', id);

    const claimRow = await query(`SELECT mc.*, u.email, u.full_name FROM mileage_claims mc JOIN users u ON mc.user_id = u.id WHERE mc.id = $1`, [id]);
    const claim = claimRow.rows[0];
    const approverRow = await query(`SELECT full_name FROM users WHERE id = $1`, [auth.userId]);
    if (claim?.email) {
      await sendExpenseDecisionEmail({
        to: claim.email,
        claimerName: claim.full_name,
        description: claim.description,
        amount: parseFloat(claim.amount),
        decision: 'approved',
        approverName: approverRow.rows[0]?.full_name || 'Your approver',
        type: 'mileage',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST mileage/approve error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
