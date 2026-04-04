import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { subscribeDevice, unsubscribeDevice } from '@/src/lib/notification.service'
import { z } from 'zod'

const schema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
  deviceLabel: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  await subscribeDevice({
    userId: entity.user_id, workerUserId: auth.userId,
    endpoint: parsed.data.endpoint, p256dh: parsed.data.p256dh,
    auth: parsed.data.auth, deviceLabel: parsed.data.deviceLabel,
  })
  return NextResponse.json({ subscribed: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  await unsubscribeDevice(endpoint)
  return NextResponse.json({ unsubscribed: true })
}
