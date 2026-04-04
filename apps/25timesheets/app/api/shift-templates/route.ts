import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { listTemplates, createTemplate } from '@/src/lib/shift-template.service'
import { z } from 'zod'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'scheduling', 'view')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const templates = await listTemplates(entity.user_id, entity.id)
  return NextResponse.json({ templates })
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  siteId: z.string().uuid().optional(),
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number().min(0).optional(),
  isPaidBreak: z.boolean().optional(),
  recurrence: z.object({}).passthrough().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'scheduling', 'create')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const template = await createTemplate({ userId: entity.user_id, entityId: entity.id, ...parsed.data })
  return NextResponse.json({ template }, { status: 201 })
}
