import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { endBreak } from '@/src/lib/clock.service'
import { z } from 'zod'

const schema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity found' }, { status: 400 })

  try {
    const breakRecord = await endBreak({
      workerId: auth.userId,
      entityId: entity.id,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    })
    return NextResponse.json({ break: breakRecord })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'End break failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
