import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listReviews, createReview } from '@/lib/services/qa.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const agentId = req.nextUrl.searchParams.get('agent_id') || undefined
  return NextResponse.json(await listReviews(user.activeEntityId, agentId))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.conversation_id || !body.scores) return NextResponse.json({ error: 'conversation_id and scores required' }, { status: 400 })
  const review = await createReview(user.activeEntityId, { ...body, reviewer_id: user.userId })
  return NextResponse.json(review, { status: 201 })
}
