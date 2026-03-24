import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { markBillPaid } from '@/src/lib/bill.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { logAudit } from '@/src/lib/audit.service';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    let paymentDate: string | undefined;
    let bankAccountId: string | undefined;
    let reference: string | undefined;

    try {
      const body = await req.json();
      paymentDate = body.paymentDate || undefined;
      bankAccountId = body.bankAccountId || undefined;
      reference = body.reference || undefined;
    } catch {
      // body is optional — fall back to defaults
    }

    const dateToCheck = paymentDate || new Date().toISOString().split('T')[0];
    const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
    if (lockCheck.locked) {
      return NextResponse.json({
        error: 'PERIOD_LOCKED',
        lockedThrough: lockCheck.lockedThrough,
        reason: lockCheck.reason,
        earliestUnlockedDate: lockCheck.earliestUnlockedDate,
      }, { status: 403 });
    }

    const bill = await markBillPaid(auth.userId, id, entity.id, { paymentDate, bankAccountId, reference });
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    await logAudit(auth.userId, 'bill.paid', 'bill', id, {
      supplier: bill.supplier_name,
      amount: bill.amount,
      paymentDate,
      bankAccountId,
    });
    return NextResponse.json({ bill });
  } catch (e) {
    console.error('Pay bill error:', e);
    return NextResponse.json({ error: 'Failed to mark bill as paid' }, { status: 500 });
  }
}
