import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { getPOApproverMappings, setPOApproverMapping } from '@/src/lib/po_approver_mapping.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }
    const mappings = await getPOApproverMappings(entity.id);
    return NextResponse.json({ mappings });
  } catch (e) {
    console.error('GET po approver-mappings error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const { staffUserId, approverUserId } = await req.json();
    if (!staffUserId || !approverUserId) {
      return NextResponse.json({ error: 'staffUserId and approverUserId required' }, { status: 400 });
    }
    if (staffUserId === approverUserId) {
      return NextResponse.json({ error: 'Staff member cannot be their own approver' }, { status: 400 });
    }

    const mapping = await setPOApproverMapping(entity.id, staffUserId, approverUserId);
    return NextResponse.json({ mapping }, { status: 201 });
  } catch (e) {
    console.error('POST po approver-mapping error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
