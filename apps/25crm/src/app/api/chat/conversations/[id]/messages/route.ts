import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { conversationService, connectMessageService } from '@/lib/chat-services'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const since = req.nextUrl.searchParams.get('since') || undefined
  return NextResponse.json(await connectMessageService.getMessages(id, since))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const conv = await conversationService.getConversationById(id)
  if (!conv || conv.entity_id !== user.activeEntityId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  const msg = await connectMessageService.createMessage({
    conversation_id: id,
    entity_id: user.activeEntityId,
    channel: conv.channel,
    sender_type: body.sender_type || 'agent',
    sender_id: user.userId,
    body: body.body.trim(),
  })

  return NextResponse.json(msg, { status: 201 })
}
