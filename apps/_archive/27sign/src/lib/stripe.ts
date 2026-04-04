import Stripe from 'stripe'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
  : null

export default stripe

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://esign.relentify.com'

export async function createSubscriptionCheckout(params: {
  userId: string
  email: string
  tier: string
  stripeCustomerId?: string | null
}): Promise<{ url: string; sessionId: string }> {
  if (!stripe) throw new Error('Stripe not configured')

  let customerId = params.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: params.email,
      metadata: { userId: params.userId, app: 'esign' },
    })
    customerId = customer.id
  }

  const priceId = getPriceId(params.tier)
  if (!priceId) throw new Error(`No price for tier: ${params.tier}`)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings?upgraded=true`,
    cancel_url: `${APP_URL}/settings?cancelled=true`,
    metadata: { userId: params.userId, tier: params.tier, app: 'esign' },
  })

  return { url: session.url!, sessionId: session.id }
}

export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  if (!stripe) throw new Error('Stripe not configured')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  return stripe.webhooks.constructEvent(body, signature, secret)
}

function getPriceId(tier: string): string | null {
  const map: Record<string, string | undefined> = {
    personal: process.env.STRIPE_PRICE_PERSONAL,
    standard: process.env.STRIPE_PRICE_STANDARD,
    business_pro: process.env.STRIPE_PRICE_BUSINESS_PRO,
  }
  return map[tier] || null
}
