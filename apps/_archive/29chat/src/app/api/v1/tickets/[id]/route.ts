import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { getTicketById, updateTicket } from '@/lib/services/ticket.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const ticket = await getTicketById(id, apiKey.entity_id)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(ticket)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const ticket = await updateTicket(id, apiKey.entity_id, body)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(ticket)
}
