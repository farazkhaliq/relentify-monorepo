import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { listEntries } from '@/src/lib/entry.service'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const url = new URL(req.url)
  const result = await listEntries({
    userId: entity.user_id,
    entityId: entity.id,
    workerId: url.searchParams.get('workerId') || undefined,
    status: url.searchParams.get('status') || undefined,
    siteId: url.searchParams.get('siteId') || undefined,
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    page: parseInt(url.searchParams.get('page') || '1'),
    limit: parseInt(url.searchParams.get('limit') || '50'),
  })
  return NextResponse.json(result)
}
