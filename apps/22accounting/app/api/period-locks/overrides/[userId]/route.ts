import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getActiveEntity } from '@/src/lib/entity.service';
import { getUserById } from '@/src/lib/user.service';
import { revokeOverride } from '@/src/lib/period_lock.service';

function canManageLocks(tier: string | null | undefined, isOwner: boolean): boolean {
  return isOwner || tier === 'accountant';
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entity = await getActiveEntity(auth.userId);
  if (!entity) return NextResponse.json({ error: 'No active entity' }, { status: 400 });
  const user = await getUserById(auth.userId);
  if (!canManageLocks(user?.tier, entity.user_id === auth.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = await params;
  await revokeOverride(entity.id, userId);
  return NextResponse.json({ success: true });
}
