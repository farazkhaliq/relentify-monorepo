import { NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getDailySummary } from '@/src/lib/dashboard.service'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const today = new Date().toISOString().split('T')[0]
  const summary = await getDailySummary(entity.user_id, entity.id, today)
  return NextResponse.json(summary)
}
