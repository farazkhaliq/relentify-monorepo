import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getBillById, updateBill, deleteBill } from '@/src/lib/bill.service';
import { logAudit } from '@/src/lib/audit.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { isDateLocked } from '@/src/lib/period_lock.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const bill = await getBillById(auth.userId, id, entity?.id);
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    return NextResponse.json({ bill });
  } catch (e) {
    console.error('GET bill error:', e);
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const existingBill = await getBillById(auth.userId, id, entity?.id);
    if (!existingBill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (entity) {
      const dateToCheck = (existingBill as any).invoice_date || existingBill.due_date;
      const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
      if (lockCheck.locked) {
        return NextResponse.json({
          error: 'PERIOD_LOCKED',
          lockedThrough: lockCheck.lockedThrough,
          reason: lockCheck.reason,
          earliestUnlockedDate: lockCheck.earliestUnlockedDate,
        }, { status: 403 });
      }
    }
    const body = await req.json();
    const bill = await updateBill(auth.userId, id, {
      supplierName: body.supplierName,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      currency: body.currency,
      dueDate: body.dueDate,
      category: body.category,
      notes: body.notes,
      reference: body.reference,
      status: body.status,
    });
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    return NextResponse.json({ bill });
  } catch (e) {
    console.error('PATCH bill error:', e);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { id } = await params;
    const existingBill = await getBillById(auth.userId, id, entity?.id);
    if (!existingBill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (entity) {
      const dateToCheck = (existingBill as any).invoice_date || existingBill.due_date;
      const lockCheck = await isDateLocked(entity.id, dateToCheck, auth.userId);
      if (lockCheck.locked) {
        return NextResponse.json({
          error: 'PERIOD_LOCKED',
          lockedThrough: lockCheck.lockedThrough,
          reason: lockCheck.reason,
          earliestUnlockedDate: lockCheck.earliestUnlockedDate,
        }, { status: 403 });
      }
    }
    await deleteBill(auth.userId, id);
    await logAudit(auth.userId, 'bill.deleted', 'bill', id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE bill error:', e);
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
  }
}
