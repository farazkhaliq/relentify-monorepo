import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { markExpenseReimbursed, deleteExpense } from '@/src/lib/expense.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { isDateLocked } from '@/src/lib/period_lock.service';
import { query } from '@/src/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    const { action } = await req.json();
    if (action === 'reimburse') {
      if (entity) {
        const r = await query(`SELECT date FROM expenses WHERE id=$1 AND user_id=$2`, [id, auth.userId]);
        if (r.rows[0]) {
          const expDate = r.rows[0].date instanceof Date
            ? r.rows[0].date.toISOString().split('T')[0]
            : String(r.rows[0].date).split('T')[0];
          const lockCheck = await isDateLocked(entity.id, expDate, auth.userId);
          if (lockCheck.locked) {
            return NextResponse.json({
              error: 'PERIOD_LOCKED',
              lockedThrough: lockCheck.lockedThrough,
              reason: lockCheck.reason,
              earliestUnlockedDate: lockCheck.earliestUnlockedDate,
            }, { status: 403 });
          }
        }
      }
      const expense = await markExpenseReimbursed(auth.userId, id);
      if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ expense });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const entity = await getActiveEntity(auth.userId);
    if (entity) {
      const r = await query(`SELECT date FROM expenses WHERE id=$1 AND user_id=$2`, [id, auth.userId]);
      if (r.rows[0]) {
        const expDate = r.rows[0].date instanceof Date
          ? r.rows[0].date.toISOString().split('T')[0]
          : String(r.rows[0].date).split('T')[0];
        const lockCheck = await isDateLocked(entity.id, expDate, auth.userId);
        if (lockCheck.locked) {
          return NextResponse.json({
            error: 'PERIOD_LOCKED',
            lockedThrough: lockCheck.lockedThrough,
            reason: lockCheck.reason,
            earliestUnlockedDate: lockCheck.earliestUnlockedDate,
          }, { status: 403 });
        }
      }
    }
    await deleteExpense(auth.userId, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
