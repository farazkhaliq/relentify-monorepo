import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get sessions with QA reviews in metadata
  const result = await pool.query(
    `SELECT id, metadata, assigned_agent_id, created_at
     FROM chat_sessions
     WHERE entity_id = $1 AND metadata ? 'qa_review'
     ORDER BY created_at DESC LIMIT 50`,
    [user.activeEntityId]
  )

  return NextResponse.json(result.rows.map(r => ({
    session_id: r.id,
    review: r.metadata.qa_review,
    assigned_agent_id: r.assigned_agent_id,
    created_at: r.created_at,
  })))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { session_id, helpfulness, accuracy, tone, notes } = body

  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const review = {
    reviewer_id: user.userId,
    scores: {
      helpfulness: Math.min(5, Math.max(1, helpfulness || 3)),
      accuracy: Math.min(5, Math.max(1, accuracy || 3)),
      tone: Math.min(5, Math.max(1, tone || 3)),
    },
    notes: notes || '',
    reviewed_at: new Date().toISOString(),
  }

  await pool.query(
    `UPDATE chat_sessions SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{qa_review}', $1::jsonb) WHERE id = $2 AND entity_id = $3`,
    [JSON.stringify(review), session_id, user.activeEntityId]
  )

  return NextResponse.json(review, { status: 201 })
}
