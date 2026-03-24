import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getAllBills, createBill } from '@/src/lib/bill.service';
import { canAccess } from '@/src/lib/tiers';
import { getUserById } from '@/src/lib/user.service';
import { logAudit } from '@/src/lib/audit.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { checkPermission } from '@/src/lib/workspace-auth';
import { getPOSettings, getPOById, fulfillPO } from '@/src/lib/po.service';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const bills = await getAllBills(auth.userId, entity?.id);
    return NextResponse.json({ bills });
  } catch (e) {
    console.error('GET bills error:', e);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const denied = checkPermission(auth, 'bills', 'create');
    if (denied) return denied;

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'enter_bills')) {
      return NextResponse.json({ error: 'Upgrade to Sole Trader to enter bills' }, { status: 403 });
    }

    const body = await req.json();
    const { supplierName, amount, vatRate, vatAmount, currency, invoiceDate, dueDate, category, notes, reference, projectId, poId, poVarianceReason } = body;

    if (currency && currency !== 'GBP' && !canAccess(user?.tier, 'multi_currency')) {
      return NextResponse.json({ error: 'Multi-currency bills require the Medium Business plan or above' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    if (!supplierName) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    if (!amount || isNaN(parseFloat(amount))) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    if (!dueDate) return NextResponse.json({ error: 'Due date is required' }, { status: 400 });

    // If linking to a PO, validate and check variance
    if (poId) {
      const po = await getPOById(poId, entity.id);
      if (!po || po.status !== 'approved') {
        return NextResponse.json({ error: 'PO not found or not approved' }, { status: 400 });
      }
      const settings = await getPOSettings(entity.id);
      const billTotal = parseFloat(amount);
      const poTotal = parseFloat(po.total);
      const variancePct = settings?.variance_tolerance_pct ? parseFloat(settings.variance_tolerance_pct) : 0;
      const pctDiff = poTotal > 0 ? Math.abs((billTotal - poTotal) / poTotal) * 100 : 0;
      if (billTotal > poTotal && pctDiff > variancePct && !poVarianceReason?.trim()) {
        return NextResponse.json({
          error: `Bill amount is ${pctDiff.toFixed(1)}% over the PO total — a variance reason is required`,
          requiresVarianceReason: true,
        }, { status: 422 });
      }
    }

    const dateToCheck = invoiceDate || dueDate;
    const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const billTotal = parseFloat(amount);
    let resolvedVarianceReason = poVarianceReason?.trim() || null;

    const bill = await createBill(auth.userId, {
      entityId: entity.id,
      supplierName,
      amount: billTotal,
      vatRate: vatRate != null ? parseFloat(vatRate) : 0,
      vatAmount: vatAmount != null ? parseFloat(vatAmount) : 0,
      currency,
      invoiceDate: invoiceDate || undefined,
      dueDate,
      category,
      notes,
      reference,
      projectId,
      poId: poId || undefined,
      poVarianceReason: resolvedVarianceReason || undefined,
    });

    // Fulfill the PO now that a bill has been linked
    if (poId) {
      const po = await getPOById(poId, entity.id);
      if (po) {
        const poTotal = parseFloat(po.total);
        const pctDiff = poTotal > 0 ? Math.abs((billTotal - poTotal) / poTotal) * 100 : 0;
        const settings = await getPOSettings(entity.id);
        const variancePct = settings?.variance_tolerance_pct ? parseFloat(settings.variance_tolerance_pct) : 0;
        const withVariance = billTotal > poTotal && pctDiff > variancePct;
        await fulfillPO(poId, entity.id, withVariance);
        await logAudit(auth.userId, 'fulfill', 'purchase_order', poId, { billId: bill.id, billTotal, withVariance });
      }
    }

    await logAudit(auth.userId, 'bill.created', 'bill', bill.id, { supplier: supplierName, amount, currency, poId: poId || null });
    return NextResponse.json({ bill }, { status: 201 });
  } catch (e) {
    console.error('POST bill error:', e);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}
