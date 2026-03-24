import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getHmrcAuthUrl } from '@/src/lib/hmrc.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = `${auth.userId}-${Date.now()}`;
  const url = getHmrcAuthUrl(state);
  const res = NextResponse.redirect(url);
  // Store state in httpOnly cookie for CSRF validation in callback
  res.cookies.set('hmrc_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — enough to complete OAuth
    path: '/',
  });
  return res;
}
