import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { clearHmrcTokens } from '@/src/lib/hmrc.service';

export async function DELETE() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await clearHmrcTokens(auth.userId);
  return NextResponse.json({ success: true });
}
