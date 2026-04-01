import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { getPOById, cancelPO } from '@/src/lib/po.service';
import { logAudit } from '@/src/lib/audit.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { id } = await params;
    const po = await getPOById(id, entity.id);
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ po });
  } catch (e) {
    console.error('GET PO error:', e);
    return NextResponse.json({ error: 'Failed to fetch purchase order' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const denied = checkPermission(auth, 'po', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    if (body.action === 'cancel') {
      const po = await cancelPO(id, entity.id);
      if (!po) return NextResponse.json({ error: 'Not found or cannot be cancelled' }, { status: 404 });
      await logAudit(auth.userId, 'cancel', 'purchase_order', id);
      return NextResponse.json({ po });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('PATCH PO error:', e);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}
