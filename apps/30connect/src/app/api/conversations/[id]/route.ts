import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getConversationById, updateConversation } from '@/lib/services/conversation.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conv = await getConversationById(id)
  if (!conv || conv.entity_id !== user.activeEntityId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(conv)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conv = await getConversationById(id)
  if (!conv || conv.entity_id !== user.activeEntityId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await updateConversation(id, body)
  return NextResponse.json(updated)
}
