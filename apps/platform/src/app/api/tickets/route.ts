import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listTickets, createTicket } from '@/lib/services/chat/ticket.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { tickets, total } = await listTickets(user.activeEntityId, {
    status: sp.get('status') || undefined,
    priority: sp.get('priority') || undefined,
    department: sp.get('department') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
  })

  return NextResponse.json({ tickets, total })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

  const ticket = await createTicket(user.activeEntityId, body)
  return NextResponse.json(ticket, { status: 201 })
}
