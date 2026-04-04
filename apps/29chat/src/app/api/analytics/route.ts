import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAnalytics } from '@/lib/services/analytics.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const now = new Date()
  const from = sp.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to = sp.get('to') || now.toISOString()

  const data = await getAnalytics(user.activeEntityId, from, to)
  return NextResponse.json(data)
}
