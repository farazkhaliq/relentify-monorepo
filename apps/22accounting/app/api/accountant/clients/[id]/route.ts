import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { revokeAccess } from '@/src/lib/accountant.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: clientUserId } = await params;
  await revokeAccess(auth.userId, clientUserId);
  return NextResponse.json({ ok: true });
}
