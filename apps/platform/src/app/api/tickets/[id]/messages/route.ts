import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getTicketById } from '@/lib/services/chat/ticket.service'
import { getMessages, createMessage } from '@/lib/services/chat/message.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const ticket = await getTicketById(id, user.activeEntityId)
  if (!ticket || !ticket.session_id) return NextResponse.json([])
  const messages = await getMessages(ticket.session_id)
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const ticket = await getTicketById(id, user.activeEntityId)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  // If ticket has no session, create one
  let sessionId = ticket.session_id
  if (!sessionId) {
    const { createSession } = await import('@/lib/services/chat/session.service')
    const session = await createSession(user.activeEntityId, ticket.visitor_id || user.userId, {
      subject: ticket.subject,
      department: ticket.department || undefined,
    })
    sessionId = session.id
    // Link session to ticket
    const pool = (await import('@/lib/pool')).default
    await pool.query('UPDATE chat_tickets SET session_id = $1 WHERE id = $2', [sessionId, id])
  }

  const message = await createMessage({
    session_id: sessionId,
    entity_id: user.activeEntityId,
    sender_type: body.sender_type || 'agent',
    sender_id: user.userId,
    body: body.body.trim(),
  })

  return NextResponse.json(message, { status: 201 })
}
