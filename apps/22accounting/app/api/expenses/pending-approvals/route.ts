import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getExpenseApprovalSettings, getPendingApprovals } from '@/src/lib/expense_approval.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ expenses: [], mileage: [] });

    // Only return pending approvals if the current user is the configured approver
    const approvalSettings = await getExpenseApprovalSettings(entity.id);
    if (!approvalSettings?.enabled || approvalSettings.approver_user_id !== auth.userId) {
      return NextResponse.json({ expenses: [], mileage: [] });
    }

    const pending = await getPendingApprovals(entity.id);
    return NextResponse.json(pending);
  } catch (e) {
    console.error('GET pending-approvals error:', e);
    return NextResponse.json({ expenses: [], mileage: [] });
  }
}
