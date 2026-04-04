import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { listWorkers, createWorker } from '@/src/lib/worker.service'
import { z } from 'zod'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const workers = await listWorkers(entity.user_id, entity.id)
  return NextResponse.json({ workers })
}

const createSchema = z.object({
  workerUserId: z.string().uuid(),
  employeeNumber: z.string().max(50).optional(),
  hourlyRate: z.number().positive().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contractor', 'casual']).optional(),
  defaultSiteId: z.string().uuid().optional(),
  managerUserId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'team', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const worker = await createWorker({ userId: entity.user_id, entityId: entity.id, ...parsed.data })
    return NextResponse.json({ worker }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 })
  }
}
