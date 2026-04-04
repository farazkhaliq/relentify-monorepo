import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { listTickets, createTicket } from '@/lib/services/chat/ticket.service'

export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { tickets, total } = await listTickets(apiKey.entity_id, {
    status: sp.get('status') || undefined,
    priority: sp.get('priority') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
  })

  return NextResponse.json({ tickets, total })
}

export async function POST(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const body = await req.json()
  if (!body.subject?.trim()) return NextResponse.json({ error: 'Subject required' }, { status: 400 })

  const ticket = await createTicket(apiKey.entity_id, body)
  return NextResponse.json(ticket, { status: 201 })
}
