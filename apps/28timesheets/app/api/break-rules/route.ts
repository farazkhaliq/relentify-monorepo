import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { listBreakRules, createBreakRule } from '@/src/lib/break-rules.service'
import { z } from 'zod'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const rules = await listBreakRules(entity.user_id, entity.id)
  return NextResponse.json({ rules })
}

const schema = z.object({
  name: z.string().min(1).max(255),
  afterWorkedMinutes: z.number().positive(),
  breakDurationMinutes: z.number().positive(),
  breakType: z.enum(['paid', 'unpaid']),
  autoDeduct: z.boolean(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'settings', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const rule = await createBreakRule({ userId: entity.user_id, entityId: entity.id, ...parsed.data })
  return NextResponse.json({ rule }, { status: 201 })
}
