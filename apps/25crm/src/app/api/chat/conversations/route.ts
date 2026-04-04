import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { conversationService } from '@/lib/chat-services'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { conversations, total } = await conversationService.listConversations(user.activeEntityId, {
    channel: sp.get('channel') || undefined,
    status: sp.get('status') || undefined,
    search: sp.get('search') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
  })

  return NextResponse.json({ conversations, total })
}
