import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listSessions } from '@/lib/services/chat/session.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { sessions, total } = await listSessions(user.activeEntityId, {
    status: sp.get('status') || undefined,
    department: sp.get('department') || undefined,
    search: sp.get('search') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
    limit: parseInt(sp.get('limit') || '50', 10),
  })

  return NextResponse.json({ sessions, total })
}
