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
      if (!entityId) break

      // Chat addon checkout
      const addon = session.metadata?.addon
      if (addon) {
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
        console.log(`[Stripe] Chat: Entity ${entityId} upgraded to ${newPlan}`)
      }

      // Connect plan checkout
      const connectPlan = session.metadata?.connect_plan
      if (connectPlan) {
        const seats = parseInt(session.metadata?.seats || '1', 10)
        await pool.query(
          `INSERT INTO connect_channels (entity_id, channel_type, config, enabled, created_at)
           VALUES ($1, '_billing', $2, true, NOW())
           ON CONFLICT (entity_id, channel_type) DO UPDATE SET config = $2`,
          [entityId, JSON.stringify({ plan: connectPlan, seats, subscription_id: session.subscription })]
        )
        console.log(`[Stripe] Connect: Entity ${entityId} subscribed to ${connectPlan} (${seats} seats)`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any

      // Check chat config
      const chatResult = await pool.query(
        'SELECT entity_id FROM chat_config WHERE stripe_subscription_id = $1',
        [subscription.id]
      )
      if (chatResult.rows[0]) {
        await pool.query(
          `UPDATE chat_config SET plan = 'free', stripe_subscription_id = NULL, updated_at = NOW() WHERE entity_id = $1`,
          [chatResult.rows[0].entity_id]
        )
        console.log(`[Stripe] Chat: Entity ${chatResult.rows[0].entity_id} downgraded to free`)
      }

      // Check connect billing
      const connectResult = await pool.query(
        `SELECT entity_id FROM connect_channels WHERE channel_type = '_billing' AND config->>'subscription_id' = $1`,
        [subscription.id]
      )
      if (connectResult.rows[0]) {
        await pool.query(
          `DELETE FROM connect_channels WHERE entity_id = $1 AND channel_type = '_billing'`,
          [connectResult.rows[0].entity_id]
        )
        console.log(`[Stripe] Connect: Entity ${connectResult.rows[0].entity_id} subscription cancelled`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as any
      const connectResult = await pool.query(
        `SELECT entity_id FROM connect_channels WHERE channel_type = '_billing' AND config->>'subscription_id' = $1`,
        [subscription.id]
      )
      if (connectResult.rows[0]) {
        // Plan change or seat count update — metadata on the subscription has the new values
        const newPlan = subscription.metadata?.connect_plan
        const newSeats = parseInt(subscription.metadata?.seats || '1', 10)
        if (newPlan) {
          await pool.query(
            `UPDATE connect_channels SET config = $1 WHERE entity_id = $2 AND channel_type = '_billing'`,
            [JSON.stringify({ plan: newPlan, seats: newSeats, subscription_id: subscription.id }), connectResult.rows[0].entity_id]
          )
          console.log(`[Stripe] Connect: Entity ${connectResult.rows[0].entity_id} updated to ${newPlan} (${newSeats} seats)`)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
