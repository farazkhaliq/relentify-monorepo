import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { markInvoicePaidManually } from '@/src/lib/invoice.service';
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
    let amount: number | undefined;
    let bankAccountId: string | undefined;
    let reference: string | undefined;

    try {
      const body = await req.json();
      paymentDate = body.paymentDate || undefined;
      amount      = body.amount ? parseFloat(body.amount) : undefined;
      bankAccountId = body.bankAccountId || undefined;
      reference   = body.reference || undefined;
    } catch { /* body optional */ }

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

    const invoice = await markInvoicePaidManually(id, auth.userId, entity.id, {
      paymentDate, amount, bankAccountId, reference,
    });

    await logAudit(auth.userId, 'invoice.paid_manually', 'invoice', id, {
      paymentDate, amount, bankAccountId, reference,
    });

    return NextResponse.json({ invoice });
  } catch (e: unknown) {
    console.error('[invoices/[id]/pay]', e);
    const msg = e instanceof Error ? e.message : 'Failed to record payment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
