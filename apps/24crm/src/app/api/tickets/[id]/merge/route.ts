import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { mergeTickets } from '@/lib/services/chat/ticket.service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  if (!body.merge_into_id) return NextResponse.json({ error: 'merge_into_id is required' }, { status: 400 })

  const result = await mergeTickets(id, body.merge_into_id, user.activeEntityId)
  if (!result) return NextResponse.json({ error: 'Tickets not found' }, { status: 404 })

  return NextResponse.json({ success: true, target: result })
}
