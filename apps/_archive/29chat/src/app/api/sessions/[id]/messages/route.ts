import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSessionById } from '@/lib/services/session.service'
import { getMessages, createMessage } from '@/lib/services/message.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== user.activeEntityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const since = req.nextUrl.searchParams.get('since') || undefined
  const messages = await getMessages(id, since)
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== user.activeEntityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const message = await createMessage({
    session_id: id,
    entity_id: user.activeEntityId,
    sender_type: body.sender_type || 'agent',
    sender_id: user.userId,
    body: body.body.trim(),
    attachment_url: body.attachment_url,
  })

  return NextResponse.json(message, { status: 201 })
}
