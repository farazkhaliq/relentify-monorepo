import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getConnectOAuthUrl } from '@/src/lib/stripe';
import { v4 as uuidv4 } from 'uuid';
export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try { return NextResponse.json({ url: getConnectOAuthUrl(`${auth.userId}:${uuidv4()}`) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 }); }
}
