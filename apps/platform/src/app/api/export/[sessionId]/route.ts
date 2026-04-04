import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSessionById } from '@/lib/services/chat/session.service'
import { getMessages } from '@/lib/services/chat/message.service'
import { getVisitorById } from '@/lib/services/chat/visitor.service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params
  const session = await getSessionById(sessionId)
  if (!session || session.entity_id !== user.activeEntityId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const messages = await getMessages(sessionId)
  const visitor = await getVisitorById(session.visitor_id)

  const format = req.nextUrl.searchParams.get('format') || 'json'

  if (format === 'text') {
    const lines = [
      `Chat Session: ${session.id}`,
      `Visitor: ${visitor?.name || 'Anonymous'} (${visitor?.email || 'no email'})`,
      `Status: ${session.status}`,
      `Created: ${session.created_at}`,
      '',
      ...messages.map(m => {
        const time = new Date(m.created_at).toLocaleString()
        const sender = m.sender_type === 'visitor' ? (visitor?.name || 'Visitor') : m.sender_type
        return `[${time}] ${sender}: ${m.body}`
      }),
    ]
    return new Response(lines.join('\n'), {
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="chat-${sessionId}.txt"` },
    })
  }

  return NextResponse.json({ session, visitor, messages })
}
