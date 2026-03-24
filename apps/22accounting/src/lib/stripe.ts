import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
  : null;

export default stripe;

const APP_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.relentify.com';
const FEE_PCT = parseFloat(process.env.RELENTIFY_FEE_PERCENTAGE || '2.5');

export function getConnectOAuthUrl(state: string): string {
  const cid = process.env.STRIPE_CLIENT_ID;
  if (!cid) throw new Error('STRIPE_CLIENT_ID not configured');
  const p = new URLSearchParams({
    response_type: 'code', client_id: cid, scope: 'read_write',
    redirect_uri: `${APP_URL}/api/stripe/callback`, state,
    'stripe_user[country]': 'GB', 'stripe_user[currency]': 'gbp',
  });
  return `https://connect.stripe.com/oauth/authorize?${p}`;
}

export async function completeConnectOAuth(code: string): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');
  const r = await stripe.oauth.token({ grant_type: 'authorization_code', code });
  if (!r.stripe_user_id) throw new Error('Failed to get Stripe account ID');
  return r.stripe_user_id;
}

export async function createConnectCheckout(params: {
  connectedAccountId: string; invoiceId: string; invoiceNumber: string;
  clientName: string; totalPence: number; currency: string; customerEmail?: string;
}): Promise<{ url: string; sessionId: string }> {
  if (!stripe) throw new Error('Stripe not configured');
  const fee = Math.round(params.totalPence * (FEE_PCT / 100));
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: params.currency.toLowerCase(),
        product_data: { name: `Invoice ${params.invoiceNumber}`, description: `Payment to ${params.clientName}` },
        unit_amount: params.totalPence,
      },
      quantity: 1,
    }],
    payment_intent_data: { application_fee_amount: fee },
    success_url: `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/payment/cancel`,
    customer_email: params.customerEmail || undefined,
    metadata: { invoice_id: params.invoiceId, invoice_number: params.invoiceNumber, relentify_fee: fee.toString() },
  }, { stripeAccount: params.connectedAccountId });
  if (!session.url) throw new Error('No checkout URL');
  return { url: session.url, sessionId: session.id };
}

export async function getConnectedAccount(id: string) {
  if (!stripe) return null;
  try { return await stripe.accounts.retrieve(id); } catch { return null; }
}

export async function disconnectAccount(id: string) {
  if (!stripe) return false;
  try { await stripe.oauth.deauthorize({ client_id: process.env.STRIPE_CLIENT_ID!, stripe_user_id: id }); return true; } catch { return false; }
}

export function constructWebhookEvent(body: string, sig: string) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null;
  try { return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET); } catch { return null; }
}

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.relentify.com';

const TIER_PRICES: Record<string, string | undefined> = {
  sole_trader:      process.env.STRIPE_PRICE_SOLE_TRADER,
  small_business:   process.env.STRIPE_PRICE_SMALL_BUSINESS,
  medium_business:  process.env.STRIPE_PRICE_MEDIUM_BUSINESS,
  corporate:        process.env.STRIPE_PRICE_CORPORATE,
};

const TIER_COUPONS: Record<string, string | undefined> = {
  sole_trader:      process.env.STRIPE_COUPON_SOLE_TRADER,
  small_business:   process.env.STRIPE_COUPON_SMALL_BUSINESS,
  medium_business:  process.env.STRIPE_COUPON_MEDIUM_BUSINESS,
  corporate:        process.env.STRIPE_COUPON_CORPORATE,
};

export async function createSubscriptionCheckout(params: {
  userId: string;
  email: string;
  tier: string;
  stripeCustomerId?: string | null;
}): Promise<{ url: string }> {
  if (!stripe) throw new Error('Stripe not configured');
  const priceId = TIER_PRICES[params.tier];
  if (!priceId) throw new Error(`No price configured for tier: ${params.tier}`);
  const couponId = TIER_COUPONS[params.tier];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(params.stripeCustomerId
      ? { customer: params.stripeCustomerId }
      : { customer_email: params.email }),
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: couponId ? [{ coupon: couponId }] : [],
    metadata: { user_id: params.userId, tier: params.tier },
    success_url: `${ACCOUNTS_URL}/dashboard?upgraded=true`,
    cancel_url: `${ACCOUNTS_URL}/dashboard/upgrade`,
  });

  if (!session.url) throw new Error('No checkout URL returned');
  return { url: session.url };
}
