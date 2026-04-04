import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getOrCreateSubscription } from '@/lib/services/esign/subscription'
import { TIER_LIMITS } from '@/lib/services/esign/tiers'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await getOrCreateSubscription(user.userId)
  const limits = TIER_LIMITS[sub.tier]

  return NextResponse.json({
    tier: sub.tier,
    status: sub.subscriptionStatus,
    requestsThisMonth: sub.requestsThisMonth,
    requestLimit: limits.requestsPerMonth,
    apiKeyLimit: limits.apiKeys,
  })
}
