import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { getActiveOverrides, grantOverride } from '@/src/lib/period_lock.service';

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
  const overrides = await getActiveOverrides(entity.id);
  return NextResponse.json({ overrides });
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

  const { userId, overrideUntil } = await req.json();
  if (!userId || !overrideUntil) {
    return NextResponse.json({ error: 'userId and overrideUntil required' }, { status: 400 });
  }

  const until = new Date(overrideUntil);
  if (isNaN(until.getTime()) || until <= new Date()) {
    return NextResponse.json({ error: 'overrideUntil must be a future datetime' }, { status: 400 });
  }

  await grantOverride(entity.id, userId, auth.userId, until);
  return NextResponse.json({ success: true });
}
