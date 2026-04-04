import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Get contact email
  const contact = await pool.query('SELECT email FROM crm_contacts WHERE id = $1 AND entity_id = $2', [id, user.activeEntityId])
  if (!contact.rows[0]) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const email = contact.rows[0].email
  if (!email) return NextResponse.json({ conversations: [], sessions: [] })

  // Get connect conversations by email
  const conversations = await pool.query(
    `SELECT * FROM connect_conversations WHERE contact_email = $1 AND entity_id = $2 ORDER BY updated_at DESC LIMIT 20`,
    [email, user.activeEntityId]
  )

  // Get chat sessions by visitor email
  const sessions = await pool.query(
    `SELECT cs.* FROM chat_sessions cs
     JOIN chat_visitors cv ON cs.visitor_id = cv.id
     WHERE cv.email = $1 AND cv.entity_id = $2
     ORDER BY cs.updated_at DESC LIMIT 20`,
    [email, user.activeEntityId]
  )

  return NextResponse.json({
    conversations: conversations.rows,
    sessions: sessions.rows,
  })
}
