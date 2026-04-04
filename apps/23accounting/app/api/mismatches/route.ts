import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getActiveEntity } from '@/src/lib/entity.service';
import { canAccess } from '@/src/lib/tiers';
import { getMismatches, getMismatchCount } from '@/src/lib/mismatch.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserById(auth.userId);
    if (!canAccess(user?.tier, 'mismatch_flagging')) {
      return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
    }

    const entity = await getActiveEntity(auth.userId);
    if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
    const entityId = entity.id;

    const status = req.nextUrl.searchParams.get('status') || undefined;
    const mismatches = await getMismatches(auth.userId, entityId, status);
    const openCount = await getMismatchCount(auth.userId, entityId);

    return NextResponse.json({ mismatches, openCount });
  } catch (err) {
    console.error('GET /api/mismatches error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
