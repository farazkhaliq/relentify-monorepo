import Stripe from 'stripe'
import pool from './pool'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
  : null

export function getStripe() {
  if (!stripe) throw new Error('Stripe not configured')
  return stripe
}

export async function createAddonCheckout(entityId: string, addon: 'branding' | 'ai'): Promise<string> {
  const s = getStripe()

  // Get or create Stripe customer
  const config = await pool.query('SELECT stripe_customer_id FROM chat_config WHERE entity_id = $1', [entityId])
  let customerId = config.rows[0]?.stripe_customer_id

  if (!customerId) {
    const customer = await s.customers.create({
      metadata: { entity_id: entityId, app: '29chat' },
    })
    customerId = customer.id
    await pool.query('UPDATE chat_config SET stripe_customer_id = $1 WHERE entity_id = $2', [customerId, entityId])
  }

  const priceId = addon === 'branding'
    ? process.env.STRIPE_PRICE_BRANDING
    : process.env.STRIPE_PRICE_AI

  if (!priceId) throw new Error(`Stripe price not configured for ${addon}`)

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=cancel`,
    metadata: { entity_id: entityId, addon },
  })

  return session.url!
}

export async function createPortalSession(entityId: string): Promise<string> {
  const s = getStripe()
  const config = await pool.query('SELECT stripe_customer_id FROM chat_config WHERE entity_id = $1', [entityId])
  const customerId = config.rows[0]?.stripe_customer_id

  if (!customerId) throw new Error('No Stripe customer found')

  const session = await s.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })

  return session.url
}

export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
  const s = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('Stripe webhook secret not configured')
  return s.webhooks.constructEvent(body, signature, secret)
}
