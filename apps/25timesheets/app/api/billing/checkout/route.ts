import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { query } from '@/src/lib/db'
import Stripe from 'stripe'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
  : null

const PRICE_IDS: Record<string, string | undefined> = {
  lite: process.env.STRIPE_PRICE_TS_LITE,
  core: process.env.STRIPE_PRICE_TS_CORE,
  pro: process.env.STRIPE_PRICE_TS_PRO,
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://timesheets.relentify.com'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const { plan } = await req.json()
  const priceId = PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: `No price for plan: ${plan}` }, { status: 400 })

  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })

  // Count active workers for per-seat quantity
  const workerCount = await query(
    `SELECT COUNT(*)::int as count FROM ts_workers WHERE user_id = $1 AND entity_id = $2 AND is_active = true`,
    [entity.user_id, entity.id]
  )
  const quantity = Math.max(1, workerCount.rows[0]?.count || 1)

  // Get or create Stripe customer
  const userResult = await query(`SELECT stripe_customer_id, email FROM users WHERE id = $1`, [auth.userId])
  let customerId = userResult.rows[0]?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({ email: userResult.rows[0]?.email })
    customerId = customer.id
    await query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, auth.userId])
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity }],
    metadata: { user_id: auth.userId, product: 'timesheets', plan },
    success_url: `${APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${APP_URL}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
