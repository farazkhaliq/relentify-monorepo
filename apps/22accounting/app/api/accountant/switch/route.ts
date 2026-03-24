import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, generateToken, setClientCookie, clearClientCookie } from '@/src/lib/auth';
import { getActiveClientForAccountant } from '@/src/lib/accountant.service';
import { getUserById } from '@/src/lib/user.service';

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { clientUserId } = await req.json();
  if (!clientUserId) return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });

  const relationship = await getActiveClientForAccountant(auth.userId, clientUserId);
  if (!relationship) {
    return NextResponse.json({ error: 'No active relationship with this client' }, { status: 403 });
  }

  const clientUser = await getUserById(clientUserId);
  if (!clientUser) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const clientToken = generateToken({
    userId: clientUserId,
    actorId: auth.userId,
    email: clientUser.email,
    userType: clientUser.user_type,
    fullName: clientUser.full_name,
    subscriptionPlan: clientUser.tier,
    isAccountantAccess: true,
  });

  const res = NextResponse.json({ ok: true });
  const cookie = setClientCookie(clientToken);
  res.headers.set('Set-Cookie', cookie['Set-Cookie']);
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const cookie = clearClientCookie();
  res.headers.set('Set-Cookie', cookie['Set-Cookie']);
  return res;
}
