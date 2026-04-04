import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'
import pool from '@/lib/pool'
import { createTicket } from '@/lib/services/chat/ticket.service'

const PORTAL_COOKIE = 'chat_portal_token'

function getPortalUser(req: NextRequest) {
  const token = req.cookies.get(PORTAL_COOKIE)?.value
  if (!token) return null
  try {
    return verify(token, process.env.JWT_SECRET || 'fallback-dev-secret') as any
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const user = getPortalUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await pool.query(
    `SELECT * FROM chat_tickets WHERE entity_id = $1 AND visitor_id = $2 ORDER BY updated_at DESC`,
    [user.entity_id, user.visitor_id]
  )
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const user = getPortalUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 })

  const ticket = await createTicket(user.entity_id, {
    subject: body.subject,
    visitor_id: user.visitor_id,
    priority: body.priority || 'medium',
  })

  return NextResponse.json(ticket, { status: 201 })
}
