import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import pool from '@/lib/pool'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err: any) {
    console.error('Stripe webhook verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      const entityId = session.metadata?.entity_id
      const addon = session.metadata?.addon
      if (!entityId || !addon) break

      // Determine new plan based on addon and current plan
      const config = await pool.query('SELECT plan FROM chat_config WHERE entity_id = $1', [entityId])
      const currentPlan = config.rows[0]?.plan || 'free'

      let newPlan = currentPlan
      if (addon === 'branding') {
        newPlan = currentPlan === 'ai' ? 'branding_ai' : 'branding'
      } else if (addon === 'ai') {
        newPlan = currentPlan === 'branding' ? 'branding_ai' : 'ai'
      }

      await pool.query(
        `UPDATE chat_config SET plan = $1, stripe_subscription_id = $2, updated_at = NOW() WHERE entity_id = $3`,
        [newPlan, session.subscription, entityId]
      )
      console.log(`[Stripe] Entity ${entityId} upgraded to ${newPlan}`)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any
      // Find entity by subscription ID
      const result = await pool.query(
        'SELECT entity_id, plan FROM chat_config WHERE stripe_subscription_id = $1',
        [subscription.id]
      )
      if (result.rows[0]) {
        const entityId = result.rows[0].entity_id
        const currentPlan = result.rows[0].plan

        // Downgrade: remove the cancelled addon
        let newPlan = 'free'
        if (currentPlan === 'branding_ai') {
          // One of the two was cancelled — we'd need to check which, but simplify to free for now
          newPlan = 'free'
        }

        await pool.query(
          `UPDATE chat_config SET plan = $1, stripe_subscription_id = NULL, updated_at = NOW() WHERE entity_id = $2`,
          [newPlan, entityId]
        )
        console.log(`[Stripe] Entity ${entityId} downgraded to ${newPlan}`)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
