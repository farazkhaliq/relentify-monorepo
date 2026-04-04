import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSessionById, updateSession } from '@/lib/services/chat/session.service'
import { getVisitorById } from '@/lib/services/chat/visitor.service'
import pool from '@/lib/pool'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== user.activeEntityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const visitor = await getVisitorById(session.visitor_id)

  // Get assigned agent name if any
  let agent_name = null
  if (session.assigned_agent_id) {
    const agentResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [session.assigned_agent_id])
    agent_name = agentResult.rows[0]?.full_name || null
  }

  return NextResponse.json({ ...session, visitor, agent_name })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== user.activeEntityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const updated = await updateSession(id, {
    status: body.status,
    assigned_agent_id: body.assigned_agent_id,
    department: body.department,
    ai_enabled: body.ai_enabled,
    subject: body.subject,
  })

  return NextResponse.json(updated)
}
