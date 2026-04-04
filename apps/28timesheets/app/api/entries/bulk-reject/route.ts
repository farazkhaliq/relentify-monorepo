import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { bulkReject } from '@/src/lib/approval.service'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'timesheets', 'approve')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const { entryIds, reason } = await req.json()
  if (!Array.isArray(entryIds) || !reason) return NextResponse.json({ error: 'entryIds and reason required' }, { status: 400 })
  const result = await bulkReject(entryIds, auth.userId, entity.user_id, entity.id, reason)
  return NextResponse.json(result)
}
