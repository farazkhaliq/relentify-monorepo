import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listReviews, createReview } from '@/lib/services/connect/qa.service'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentId = req.nextUrl.searchParams.get('agent_id') || undefined
  const reviews = await listReviews(user.activeEntityId, agentId)
  return NextResponse.json(reviews)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Support both connect format (conversation_id + scores) and chat format (session_id + individual scores)
  const conversationId = body.conversation_id || body.session_id
  if (!conversationId) return NextResponse.json({ error: 'conversation_id or session_id required' }, { status: 400 })

  const scores = body.scores || {
    helpfulness: Math.min(5, Math.max(1, body.helpfulness || 3)),
    accuracy: Math.min(5, Math.max(1, body.accuracy || 3)),
    tone: Math.min(5, Math.max(1, body.tone || 3)),
  }

  const review = await createReview(user.activeEntityId, {
    conversation_id: conversationId,
    reviewer_id: user.userId,
    agent_id: body.agent_id,
    scores,
    notes: body.notes,
    coaching_notes: body.coaching_notes,
  })

  return NextResponse.json(review, { status: 201 })
}
