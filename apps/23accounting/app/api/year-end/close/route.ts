// app/api/year-end/close/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { logAudit } from '@/src/lib/audit.service';
import { runYearEndClose } from '@/src/lib/year_end.service';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'year_end_close')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const body = await req.json();
    const { yearEndDate } = body;

    if (!yearEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(yearEndDate)) {
      return NextResponse.json({ error: 'Missing or invalid yearEndDate' }, { status: 400 });
    }

    const result = await runYearEndClose(entity.id, auth.userId, yearEndDate);

    await logAudit(auth.userId, 'year_end_close', 'entity', entity.id, {
      yearEndDate,
      journalEntryId: result.journalEntryId,
      netProfit: result.netProfit,
      lockedThroughDate: result.lockedThroughDate,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[year-end/close]', err);
    return NextResponse.json({ error: err.message || 'Year-end close failed' }, { status: 500 });
  }
}
