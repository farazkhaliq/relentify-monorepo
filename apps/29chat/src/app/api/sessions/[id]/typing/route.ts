import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { sseManager } from '@/lib/services/sse.service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  sseManager.broadcast(id, 'typing', {
    sender_type: 'agent',
    agent_id: user.userId,
    agent_name: user.fullName,
  })

  return NextResponse.json({ ok: true })
}
