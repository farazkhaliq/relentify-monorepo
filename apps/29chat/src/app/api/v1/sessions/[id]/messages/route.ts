import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { getSessionById } from '@/lib/services/session.service'
import { getMessages, createMessage } from '@/lib/services/message.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== apiKey.entity_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since = req.nextUrl.searchParams.get('since') || undefined
  return NextResponse.json(await getMessages(id, since))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== apiKey.entity_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  const message = await createMessage({
    session_id: id,
    entity_id: apiKey.entity_id,
    sender_type: body.sender_type || 'agent',
    body: body.body.trim(),
  })

  return NextResponse.json(message, { status: 201 })
}
