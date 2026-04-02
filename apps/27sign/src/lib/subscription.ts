import { query } from './db'
import type { Tier } from './tiers'

export interface UserSubscription {
  userId: string
  tier: Tier
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string
  requestsThisMonth: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
}

export async function getOrCreateSubscription(userId: string): Promise<UserSubscription> {
  const { rows } = await query(
    'SELECT * FROM user_subscriptions WHERE user_id = $1',
    [userId]
  )

  if (rows.length > 0) {
    return mapRow(rows[0])
  }

  // Auto-create free subscription
  const { rows: created } = await query(
    `INSERT INTO user_subscriptions (user_id, tier, subscription_status)
     VALUES ($1, 'free', 'active')
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId]
  )

  return mapRow(created[0])
}

export async function updateSubscription(
  userId: string,
  params: {
    tier?: string
    status?: string
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  }
): Promise<void> {
  await query(
    `UPDATE user_subscriptions SET
       tier = COALESCE($2, tier),
       subscription_status = COALESCE($3, subscription_status),
       stripe_customer_id = COALESCE($4, stripe_customer_id),
       stripe_subscription_id = COALESCE($5, stripe_subscription_id),
       updated_at = NOW()
     WHERE user_id = $1`,
    [userId, params.tier || null, params.status || null,
     params.stripeCustomerId || null, params.stripeSubscriptionId || null]
  )
}

export async function incrementRequestCount(userId: string): Promise<number> {
  const { rows } = await query(
    `UPDATE user_subscriptions
     SET requests_this_month = requests_this_month + 1, updated_at = NOW()
     WHERE user_id = $1
     RETURNING requests_this_month`,
    [userId]
  )
  return rows[0]?.requests_this_month || 0
}

function mapRow(row: any): UserSubscription {
  return {
    userId: row.user_id,
    tier: row.tier as Tier,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
    requestsThisMonth: row.requests_this_month || 0,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
  }
}
