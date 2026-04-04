import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { createComment, getComments } from '@/src/lib/comment.service'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const entryId = url.searchParams.get('entryId')
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 })
  const feedEventType = url.searchParams.get('feedEventType') || undefined
  const comments = await getComments(entryId, feedEventType)
  return NextResponse.json({ comments })
}

const schema = z.object({
  entryId: z.string().uuid(),
  feedEventType: z.string().max(30),
  body: z.string().min(1).max(1000),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const comment = await createComment({
    userId: entity.user_id, entityId: entity.id,
    entryId: parsed.data.entryId, feedEventType: parsed.data.feedEventType,
    authorUserId: auth.userId, body: parsed.data.body,
  })
  return NextResponse.json({ comment }, { status: 201 })
}
