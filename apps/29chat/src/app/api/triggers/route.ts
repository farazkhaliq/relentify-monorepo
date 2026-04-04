import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listTriggers, createTrigger } from '@/lib/services/trigger.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const triggers = await listTriggers(user.activeEntityId)
  return NextResponse.json(triggers)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const trigger = await createTrigger(user.activeEntityId, body)
  return NextResponse.json(trigger, { status: 201 })
}
