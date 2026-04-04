import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { subscribe, unsubscribe } from '@/lib/services/chat/push.service'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.subscription?.endpoint) return NextResponse.json({ error: 'Subscription required' }, { status: 400 })

  await subscribe(user.activeEntityId, user.userId, body.subscription)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.endpoint) return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })

  await unsubscribe(body.endpoint)
  return NextResponse.json({ success: true })
}
