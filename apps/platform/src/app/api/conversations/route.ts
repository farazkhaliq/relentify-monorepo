import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listConversations, createConversation } from '@/lib/services/connect/conversation.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { conversations, total } = await listConversations(user.activeEntityId, {
    channel: sp.get('channel') || undefined,
    status: sp.get('status') || undefined,
    assigned_agent_id: sp.get('assigned') || undefined,
    search: sp.get('search') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
  })

  return NextResponse.json({ conversations, total })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.channel) return NextResponse.json({ error: 'channel required' }, { status: 400 })

  const conv = await createConversation(user.activeEntityId, body)
  return NextResponse.json(conv, { status: 201 })
}
