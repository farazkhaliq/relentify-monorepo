import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { acceptInvite, getInviteByToken } from '@/src/lib/accountant.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== 'pending') {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  try {
    await acceptInvite(token, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'CLIENT_HAS_ACCOUNTANT') {
      return NextResponse.json({ error: 'You already have an active accountant. Revoke their access first.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
