import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById } from '@/src/lib/user.service';
import { getConnectedAccount } from '@/src/lib/stripe';
export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = await getUserById(auth.userId);
  if (!user?.stripe_account_id) return NextResponse.json({ connected:false, accountId:null, status:'not_connected', chargesEnabled:false, payoutsEnabled:false });
  const acct = await getConnectedAccount(user.stripe_account_id);
  return NextResponse.json({ connected:true, accountId:user.stripe_account_id, status:user.stripe_account_status, chargesEnabled:acct?.charges_enabled??false, payoutsEnabled:acct?.payouts_enabled??false });
}
