import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getLiveVisitors } from '@/lib/services/visitor.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const visitors = await getLiveVisitors(user.activeEntityId)
  return NextResponse.json(visitors)
}
