// app/api/year-end/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { canAccess } from '@/src/lib/tiers';
import { previewYearEndClose } from '@/src/lib/year_end.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'year_end_close')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });

    const yearEndDate = req.nextUrl.searchParams.get('yearEndDate');
    if (!yearEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(yearEndDate)) {
      return NextResponse.json({ error: 'Missing or invalid yearEndDate' }, { status: 400 });
    }

    const preview = await previewYearEndClose(entity.id, yearEndDate);
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error('[year-end/preview]', err);
    return NextResponse.json({ error: err.message || 'Preview failed' }, { status: 500 });
  }
}
