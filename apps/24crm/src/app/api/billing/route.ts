import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getConfig } from '@/lib/services/chat/config.service'
import { createAddonCheckout } from '@/lib/stripe'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getConfig(user.activeEntityId)
  return NextResponse.json({
    plan: config?.plan || 'free',
    stripe_customer_id: config?.stripe_customer_id || null,
    stripe_subscription_id: config?.stripe_subscription_id || null,
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Chat addon checkout (branding/ai)
  if (body.addon) {
    if (body.addon !== 'branding' && body.addon !== 'ai') {
      return NextResponse.json({ error: 'Invalid addon. Use "branding" or "ai".' }, { status: 400 })
    }
    try {
      const url = await createAddonCheckout(user.activeEntityId, body.addon)
      return NextResponse.json({ url })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // Connect plan checkout (plan + seats)
  if (body.plan) {
    const validPlans = ['starter', 'essentials', 'growth', 'professional', 'enterprise']
    if (!validPlans.includes(body.plan)) {
      return NextResponse.json({ error: `Invalid plan. Use one of: ${validPlans.join(', ')}` }, { status: 400 })
    }
    // TODO: implement Stripe subscription checkout for connect plans
    return NextResponse.json({ message: `Plan ${body.plan} checkout not yet configured — Stripe price IDs needed` }, { status: 200 })
  }

  return NextResponse.json({ error: 'Provide addon (chat) or plan (connect)' }, { status: 400 })
}
