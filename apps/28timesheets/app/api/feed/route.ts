import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getMemberRole } from '@/src/lib/team.service'
import { getFeed } from '@/src/lib/feed.service'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const role = await getMemberRole(entity.user_id, auth.userId) || 'staff'
  const url = new URL(req.url)
  const feed = await getFeed({
    userId: entity.user_id, entityId: entity.id, role,
    currentUserId: auth.userId,
    workerId: url.searchParams.get('workerId') || undefined,
    page: parseInt(url.searchParams.get('page') || '1'),
    limit: parseInt(url.searchParams.get('limit') || '20'),
  })
  return NextResponse.json(feed)
}
