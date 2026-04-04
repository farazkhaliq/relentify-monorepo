import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import pool from '@/lib/pool'
import { getMessages, createMessage } from '@/lib/services/chat/message.service'

const PORTAL_COOKIE = 'chat_portal_token'

function getPortalUser(req: NextRequest) {
  const token = req.cookies.get(PORTAL_COOKIE)?.value
  if (!token) return null
  try {
    return verify(token, process.env.JWT_SECRET || 'fallback-dev-secret') as any
  } catch { return null }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getPortalUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ticket = await pool.query(
    'SELECT * FROM chat_tickets WHERE id = $1 AND entity_id = $2 AND visitor_id = $3',
    [id, user.entity_id, user.visitor_id]
  )
  if (!ticket.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = ticket.rows[0].session_id ? await getMessages(ticket.rows[0].session_id) : []
  // Filter out internal notes
  const filtered = messages.filter((m: any) => m.sender_type !== 'note')

  return NextResponse.json({ ticket: ticket.rows[0], messages: filtered })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getPortalUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ticket = await pool.query(
    'SELECT * FROM chat_tickets WHERE id = $1 AND entity_id = $2 AND visitor_id = $3',
    [id, user.entity_id, user.visitor_id]
  )
  if (!ticket.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  let sessionId = ticket.rows[0].session_id
  if (!sessionId) {
    const { createSession } = await import('@/lib/services/chat/session.service')
    const session = await createSession(user.entity_id, user.visitor_id, { subject: ticket.rows[0].subject })
    sessionId = session.id
    await pool.query('UPDATE chat_tickets SET session_id = $1 WHERE id = $2', [sessionId, id])
  }

  const message = await createMessage({
    session_id: sessionId,
    entity_id: user.entity_id,
    sender_type: 'visitor',
    sender_id: user.visitor_id,
    body: body.body.trim(),
  })

  return NextResponse.json(message, { status: 201 })
}
