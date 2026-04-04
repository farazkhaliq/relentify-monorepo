import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { getSessionById, updateSession } from '@/lib/services/chat/session.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== apiKey.entity_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(session)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { id } = await params
  const session = await getSessionById(id)
  if (!session || session.entity_id !== apiKey.entity_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await updateSession(id, body)
  return NextResponse.json(updated)
}
