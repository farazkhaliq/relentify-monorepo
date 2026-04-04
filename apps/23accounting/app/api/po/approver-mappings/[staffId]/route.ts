import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { deletePOApproverMapping } from '@/src/lib/po_approver_mapping.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  try {
    const { staffId } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    await deletePOApproverMapping(entity.id, staffId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE po approver-mapping error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
