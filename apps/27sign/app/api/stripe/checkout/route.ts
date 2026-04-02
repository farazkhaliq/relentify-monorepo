import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getOrCreateSubscription, updateSubscription } from '@/lib/subscription'
import { createSubscriptionCheckout } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await req.json()
  if (!['personal', 'standard', 'business_pro'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const sub = await getOrCreateSubscription(user.userId)

  const { url, sessionId } = await createSubscriptionCheckout({
    userId: user.userId,
    email: user.email,
    tier,
    stripeCustomerId: sub.stripeCustomerId,
  })

  // Store customer ID if newly created
  if (!sub.stripeCustomerId) {
    // The customer ID will be updated via webhook after checkout completes
  }

  return NextResponse.json({ url })
}
