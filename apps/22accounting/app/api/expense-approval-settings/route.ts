import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getExpenseApprovalSettings, upsertExpenseApprovalSettings } from '@/src/lib/expense_approval.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const settings = await getExpenseApprovalSettings(entity.id);
    return NextResponse.json({ settings });
  } catch (e) {
    console.error('GET expense-approval-settings error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const { enabled, approverUserId } = await req.json();
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
    }

    const settings = await upsertExpenseApprovalSettings(entity.id, {
      enabled,
      approverUserId: approverUserId || null,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    console.error('PATCH expense-approval-settings error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
