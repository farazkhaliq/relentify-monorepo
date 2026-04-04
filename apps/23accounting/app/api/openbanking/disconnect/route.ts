import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { disconnectAccount } from '@/src/lib/openbanking.service';

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { connectionId } = await req.json();
  if (!connectionId) return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  await disconnectAccount(auth.userId, connectionId);
  return NextResponse.json({ success: true });
}
