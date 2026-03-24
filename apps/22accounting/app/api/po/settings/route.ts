import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { getPOSettings, upsertPOSettings } from '@/src/lib/po.service';
import { logAudit } from '@/src/lib/audit.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const settings = await getPOSettings(entity.id);
    return NextResponse.json({ settings });
  } catch (e) {
    console.error('GET PO settings error:', e);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const body = await req.json();
    const { enabled, approverUserId, approvalThreshold, varianceTolerancePct } = body;

    const settings = await upsertPOSettings(entity.id, {
      enabled: Boolean(enabled),
      approverUserId: approverUserId || null,
      approvalThreshold: parseFloat(approvalThreshold) || 0,
      varianceTolerancePct: parseFloat(varianceTolerancePct) || 0,
    });

    await logAudit(auth.userId, 'update', 'po_settings', entity.id, { enabled, approvalThreshold, varianceTolerancePct });

    return NextResponse.json({ settings });
  } catch (e) {
    console.error('PATCH PO settings error:', e);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
