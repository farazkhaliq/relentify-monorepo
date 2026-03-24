import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getEarliestUnlockedDate } from '@/src/lib/period_lock.service';

export async function GET(_req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ date: new Date().toISOString().split('T')[0] });

  const date = await getEarliestUnlockedDate(entity.id, auth.userId);
  return NextResponse.json({ date });
}
