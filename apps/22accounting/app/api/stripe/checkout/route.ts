import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/src/lib/auth';
import { getUserById, updateUserSubscription } from '@/src/lib/user.service';
import stripe, { createSubscriptionCheckout } from '@/src/lib/stripe';
import { TIER_ORDER } from '@/src/lib/tiers';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { tier } = await req.json();
    if (!tier || !TIER_ORDER.includes(tier) || tier === 'invoicing') {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const user = await getUserById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Stripe Accounts V2 requires an existing customer object — create one if needed
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId && stripe) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { user_id: auth.userId },
      });
      stripeCustomerId = customer.id;
      await updateUserSubscription(auth.userId, { stripeCustomerId });
    }

    const { url } = await createSubscriptionCheckout({
      userId: auth.userId,
      email: user.email,
      tier,
      stripeCustomerId,
    });

    return NextResponse.json({ url });
  } catch (e) {
    console.error('Checkout error:', e);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
