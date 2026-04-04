import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { listSessions, createSession } from '@/lib/services/session.service'
import { getOrCreateVisitor } from '@/lib/services/visitor.service'

export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const { sessions, total } = await listSessions(apiKey.entity_id, {
    status: sp.get('status') || undefined,
    department: sp.get('department') || undefined,
    page: parseInt(sp.get('page') || '1', 10),
    limit: parseInt(sp.get('limit') || '50', 10),
  })

  return NextResponse.json({ sessions, total })
}

export async function POST(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const body = await req.json()
  if (!body.fingerprint) return NextResponse.json({ error: 'fingerprint required' }, { status: 400 })

  const visitor = await getOrCreateVisitor(apiKey.entity_id, body.fingerprint, {
    name: body.name, email: body.email,
  })

  const session = await createSession(apiKey.entity_id, visitor.id, {
    channel: 'api', subject: body.subject, department: body.department,
  })

  return NextResponse.json({ session, visitor }, { status: 201 })
}
