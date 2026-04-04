import { NextRequest, NextResponse } from 'next/server';
import { completeConnectOAuth, getConnectedAccount } from '@/src/lib/stripe';
import { updateUserStripeAccount } from '@/src/lib/user.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code'), state = searchParams.get('state'), error = searchParams.get('error');
  const base = new URL('/dashboard/settings', req.url);
  if (error) { base.searchParams.set('stripe','error'); return NextResponse.redirect(base); }
  if (!code || !state) { base.searchParams.set('stripe','error'); return NextResponse.redirect(base); }
  const userId = state.split(':')[0];
  try {
    const acctId = await completeConnectOAuth(code);
    const acct = await getConnectedAccount(acctId);
    await updateUserStripeAccount(userId, acctId, acct?.charges_enabled ? 'active' : 'pending');
    base.searchParams.set('stripe','success');
    return NextResponse.redirect(base);
  } catch (e) { console.error('Stripe callback:', e); base.searchParams.set('stripe','error'); return NextResponse.redirect(base); }
}
