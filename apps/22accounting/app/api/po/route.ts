import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { createPO, getPOsByEntity, getPOSettings } from '@/src/lib/po.service';
import { logAudit } from '@/src/lib/audit.service';
import { sendPOApprovalRequestEmail } from '@/src/lib/email';
import { getApproverForStaff } from '@/src/lib/po_approver_mapping.service';
import { checkPermission } from '@/src/lib/workspace-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const status = req.nextUrl.searchParams.get('status') || undefined;
    const forLinking = req.nextUrl.searchParams.get('forLinking') === 'true';
    if (forLinking) {
      const { getApprovedPOsForLinking } = await import('@/src/lib/po.service');
      const pos = await getApprovedPOsForLinking(entity.id);
      return NextResponse.json({ pos });
    }
    const pos = await getPOsByEntity(entity.id, status);
    return NextResponse.json({ pos });
  } catch (e) {
    console.error('GET POs error:', e);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const denied = checkPermission(auth, 'po', 'create');
    if (denied) return denied;
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'po_approvals')) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

    const settings = await getPOSettings(entity.id);
    if (!settings?.enabled) return NextResponse.json({ error: 'Purchase orders are not enabled' }, { status: 400 });

    const body = await req.json();
    const { supplierName, description, currency, items, expectedDate, notes } = body;

    if (!supplierName?.trim()) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });

    // Calculate total to determine if approval needed
    const total = items.reduce((s: number, i: { quantity: number; unitPrice: number; vatRate: number }) => {
      const amount = i.quantity * i.unitPrice;
      return s + amount + amount * (i.vatRate / 100);
    }, 0);

    const needsApproval = total >= (parseFloat(settings.approval_threshold));
    const status = needsApproval ? 'pending_approval' : 'approved';

    const po = await createPO({
      entityId: entity.id,
      userId: auth.userId,
      requestedById: auth.userId,
      supplierName: supplierName.trim(),
      description,
      currency: currency || 'GBP',
      items,
      expectedDate,
      notes,
      status,
    });

    await logAudit(auth.userId, 'create', 'purchase_order', po.id, { status, total: po.total });

    // Send approval request email if needed — use per-staff mapping, fall back to entity-wide
    if (needsApproval) {
      const approver = await getApproverForStaff(entity.id, auth.userId);
      if (approver?.approverEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounting.relentify.com';
        await sendPOApprovalRequestEmail({
          to: approver.approverEmail,
          approverName: approver.approverName,
          requesterName: user?.full_name || 'A team member',
          poNumber: po.po_number,
          total: parseFloat(po.total),
          currency: po.currency,
          supplierName: po.supplier_name,
          description: po.description || undefined,
          approveUrl: `${appUrl}/api/po/approve-link?token=${po.approval_token}&action=approve`,
          rejectUrl: `${appUrl}/api/po/approve-link?token=${po.approval_token}&action=reject`,
        });
      }
    }

    return NextResponse.json({ po }, { status: 201 });
  } catch (e) {
    console.error('POST PO error:', e);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}
