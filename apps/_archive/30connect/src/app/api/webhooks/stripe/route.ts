import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Stripe webhook handler — placeholder for now
  const body = await req.text()
  console.log('[Stripe webhook] Received event')
  return NextResponse.json({ received: true })
}
