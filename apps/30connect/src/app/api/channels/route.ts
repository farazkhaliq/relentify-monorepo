import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getChannels, upsertChannel } from '@/lib/services/channel.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getChannels(user.activeEntityId))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.channel_type) return NextResponse.json({ error: 'channel_type required' }, { status: 400 })

  const channel = await upsertChannel(user.activeEntityId, body.channel_type, body.config || {}, body.enabled ?? true)
  return NextResponse.json(channel, { status: 201 })
}
