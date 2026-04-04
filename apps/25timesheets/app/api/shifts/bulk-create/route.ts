import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { bulkCreateShifts } from '@/src/lib/shift.service'
import { z } from 'zod'

const schema = z.object({
  workerUserIds: z.array(z.string().uuid()).min(1),
  siteId: z.string().uuid().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  days: z.array(z.number().min(1).max(7)).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'scheduling', 'create')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const shifts = await bulkCreateShifts({ userId: entity.user_id, entityId: entity.id, ...parsed.data })
  return NextResponse.json({ shifts, count: shifts.length }, { status: 201 })
}
