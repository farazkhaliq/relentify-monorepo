import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getValidHmrcToken, getVatObligations } from '@/src/lib/hmrc.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserById(auth.userId);
  if (!user?.vat_number) return NextResponse.json({ error: 'VAT number not set' }, { status: 400 });

  try {
    const token = await getValidHmrcToken(auth.userId);
    const data = await getVatObligations(user.vat_number, token, req, auth.userId);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg.includes('not connected')) return NextResponse.json({ error: 'not_connected' }, { status: 400 });
    console.error('HMRC obligations error:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
