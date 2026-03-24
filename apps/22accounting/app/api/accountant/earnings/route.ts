import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getEarningsForAccountant } from '@/src/lib/accountant_referral.service';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.userType !== 'accountant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const earnings = await getEarningsForAccountant(auth.userId);
  const total = earnings.reduce((sum, e) => sum + e.commission_amount, 0);

  return NextResponse.json({ earnings, total_pence: total });
}
