import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/services/esign/stripe'
import { updateSubscription } from '@/lib/services/esign/subscription'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Stripe webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      if (session.mode === 'subscription' && session.metadata?.app === 'esign') {
        const userId = session.metadata.userId
        const tier = session.metadata.tier
        if (userId && tier) {
          await updateSubscription(userId, {
            tier,
            status: 'active',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          })
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any
      // Find user by stripe subscription ID and downgrade
      const { query: dbQuery } = await import('@/lib/services/esign/db')
      const { rows } = await dbQuery(
        'SELECT user_id FROM esign_user_subscriptions WHERE stripe_subscription_id = $1',
        [subscription.id]
      )
      if (rows.length > 0) {
        await updateSubscription(rows[0].user_id, { tier: 'free', status: 'cancelled' })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as any
      const { query: dbQuery } = await import('@/lib/services/esign/db')
      const { rows } = await dbQuery(
        'SELECT user_id FROM esign_user_subscriptions WHERE stripe_customer_id = $1',
        [invoice.customer]
      )
      if (rows.length > 0) {
        await updateSubscription(rows[0].user_id, { status: 'past_due' })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
