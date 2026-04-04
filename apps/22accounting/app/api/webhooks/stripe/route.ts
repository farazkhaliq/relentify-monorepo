import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent } from '@/src/lib/stripe';
import { getInvoiceByCheckoutSession, markInvoicePaid } from '@/src/lib/invoice.service';
import { updateUserSubscription, getUserByStripeCustomerId } from '@/src/lib/user.service';
import { recordReferralEarning, isSubscriptionInvoice } from '@/src/lib/accountant_referral.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });
    const event = constructWebhookEvent(body, sig);
    if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        mode: string;
        payment_intent: string | null;
        customer: string | null;
        subscription: string | { id: string } | null;
        metadata: Record<string, string>;
      };

      if (session.mode === 'subscription') {
        const product = session.metadata?.product || 'accounting';
        const plan = session.metadata?.plan || session.metadata?.tier;
        // Subscription checkout — upgrade user tier
        const userId = session.metadata?.user_id;
        const tier = session.metadata?.tier;
        if (userId && tier) {
          const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
          const stripeSubscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as { id: string } | null)?.id || null;
          await updateUserSubscription(userId, {
            tier,
            status: 'active',
            stripeCustomerId,
            stripeSubscriptionId,
          });
          console.log(`✅ Subscription activated: user ${userId} → ${tier}`);
          // Update unified user_subscriptions table
          try {
            const { query: dbQuery } = await import('@/src/lib/db');
            await dbQuery(
              `INSERT INTO user_subscriptions (user_id, product, plan, status, stripe_subscription_id, updated_at)
               VALUES ($1, $2, $3, 'active', $4, NOW())
               ON CONFLICT (user_id, product) DO UPDATE SET plan = $3, status = 'active', stripe_subscription_id = $4, updated_at = NOW()`,
              [userId, product, plan || 'free', stripeSubscriptionId]
            );
          } catch (e) { console.error('user_subscriptions upsert failed:', e); }
        }
      } else {
        // Connect payment checkout — mark invoice paid
        const inv = await getInvoiceByCheckoutSession(session.id);
        if (inv && inv.status !== 'paid') {
          await markInvoicePaid(inv.id, session.payment_intent || '');
          console.log('✅ Paid:', inv.invoice_number);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as { customer: string };
      const customerId = typeof sub.customer === 'string' ? sub.customer : null;
      if (customerId) {
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          await updateUserSubscription(user.id, { tier: 'invoicing', status: 'cancelled' });
          console.log(`✅ Subscription cancelled: user ${user.id} → invoicing`);
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as { customer: string };
      const customerId = typeof inv.customer === 'string' ? inv.customer : null;
      if (customerId) {
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          await updateUserSubscription(user.id, { status: 'past_due' });
          console.log(`⚠️ Payment failed: user ${user.id} → past_due`);
        }
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const lineItems = invoice.lines?.data ?? [];
      const priceId = lineItems[0]?.price?.id;

      if (isSubscriptionInvoice(priceId)) {
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const clientUser = await getUserByStripeCustomerId(customerId);
          if (clientUser) {
            await recordReferralEarning({
              stripeInvoiceId: invoice.id,
              clientUserId: clientUser.id,
              grossAmount: invoice.amount_paid,
              currency: invoice.currency,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
