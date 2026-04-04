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
  const addon = body.addon
  if (addon !== 'branding' && addon !== 'ai') {
    return NextResponse.json({ error: 'Invalid addon. Use "branding" or "ai".' }, { status: 400 })
  }

  try {
    const url = await createAddonCheckout(user.activeEntityId, addon)
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
