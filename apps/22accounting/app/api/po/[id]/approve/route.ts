import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { approvePO, getPOById } from '@/src/lib/po.service';
import { logAudit } from '@/src/lib/audit.service';
import { sendPODecisionEmail } from '@/src/lib/email';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const denied = checkPermission(auth, 'po', 'approve');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { id } = await params;
    const poBefore = await getPOById(id, entity.id);
    if (!poBefore) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const po = await approvePO(id, auth.userId, entity.id);
    if (!po) return NextResponse.json({ error: 'Cannot approve — PO is not pending approval' }, { status: 400 });

    await logAudit(auth.userId, 'approve', 'purchase_order', id);

    // Notify requester
    if (poBefore.requested_by_id !== auth.userId) {
      const { query } = await import('@/src/lib/db');
      const reqRes = await query(`SELECT name, email FROM users WHERE id = $1`, [poBefore.requested_by_id]);
      const requester = reqRes.rows[0];
      if (requester?.email) {
        await sendPODecisionEmail({
          recipientEmail: requester.email,
          recipientName: requester.name,
          deciderName: user?.name || 'Your approver',
          decision: 'approved',
          po,
        });
      }
    }

    return NextResponse.json({ po });
  } catch (e) {
    console.error('Approve PO error:', e);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
