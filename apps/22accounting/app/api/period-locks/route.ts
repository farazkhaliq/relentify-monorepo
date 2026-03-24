import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import {
  getLockHistory,
  lockPeriod,
  unlockPeriod,
} from '@/src/lib/period_lock.service';
import { query } from '@/src/lib/db';

function canManageLocks(tier: string | null | undefined, isOwner: boolean): boolean {
  return isOwner || tier === 'accountant';
}

export async function GET(_req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entityRes = await query(
    `SELECT locked_through_date FROM entities WHERE id=$1`, [entity.id]
  );
  const lockedThrough = entityRes.rows[0]?.locked_through_date
    ? new Date(entityRes.rows[0].locked_through_date).toISOString().split('T')[0]
    : null;

  const history = await getLockHistory(entity.id);
  return NextResponse.json({ lockedThrough, history });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, fromDate, toDate, lockDate, reason } = await req.json();

  if (action === 'lock') {
    const to = toDate || lockDate;
    const from = fromDate || '1900-01-01';
    if (!to) {
      return NextResponse.json({ error: 'lockDate (or fromDate + toDate) required' }, { status: 400 });
    }
    await lockPeriod(entity.id, auth.userId, 'manual_year_end', from, to, reason);
    return NextResponse.json({ success: true });
  }

  if (action === 'unlock') {
    await unlockPeriod(entity.id, auth.userId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
