import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getActiveEntry } from '@/src/lib/entry.service'
import { recordPing } from '@/src/lib/gps.service'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const entry = await getActiveEntry(auth.userId, entity.id)
  if (!entry) return NextResponse.json({ error: 'Not clocked in' }, { status: 400 })
  const { latitude, longitude, accuracy, source } = await req.json()
  await recordPing(entry.id, { latitude, longitude, accuracy: accuracy || 0, source: source || 'low_accuracy' })
  return NextResponse.json({ recorded: true })
}
