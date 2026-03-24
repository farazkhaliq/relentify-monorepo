import { NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById, clearUserStripeAccount } from '@/src/lib/user.service';
import { disconnectAccount } from '@/src/lib/stripe';
export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const user = await getUserById(auth.userId);
  if (user?.stripe_account_id) { await disconnectAccount(user.stripe_account_id); await clearUserStripeAccount(auth.userId); }
  return NextResponse.json({ success: true });
}
