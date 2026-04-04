import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { clockIn } from '@/src/lib/clock.service'
import { z } from 'zod'

const schema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  siteId: z.string().uuid().optional(),
  projectTag: z.string().max(255).optional(),
  photoUrl: z.string().optional(),
  photoHash: z.string().max(64).optional(),
  idempotencyKey: z.string().max(100).optional(),
  screenSize: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity found' }, { status: 400 })

  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
  const device = { userAgent: req.headers.get('user-agent'), screenSize: parsed.data.screenSize }

  try {
    const entry = await clockIn({
      workerId: auth.userId,
      userId: entity.user_id,
      entityId: entity.id,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      ip,
      device,
      photoUrl: parsed.data.photoUrl,
      photoHash: parsed.data.photoHash,
      siteId: parsed.data.siteId,
      projectTag: parsed.data.projectTag,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Clock-in failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
