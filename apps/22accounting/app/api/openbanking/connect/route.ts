import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getTrueLayerAuthUrl } from '@/src/lib/openbanking.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const state = `${auth.userId}-${Date.now()}`;
  return NextResponse.redirect(getTrueLayerAuthUrl(state));
}
