import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getMessages, createMessage } from '@/lib/services/message.service'
import { getSessionById } from '@/lib/services/session.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  const { id } = await params
  const since = req.nextUrl.searchParams.get('since') || undefined
  const messages = await getMessages(id, since)

  // Filter out internal notes from widget responses
  const filtered = messages.filter(m => m.sender_type !== 'note')

  return NextResponse.json(filtered, { headers: corsHeaders })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  try {
    const { id } = await params
    const body = await req.json()

    if (!body.body?.trim()) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400, headers: corsHeaders })
    }

    const session = await getSessionById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders })
    }

    const message = await createMessage({
      session_id: id,
      entity_id: session.entity_id,
      sender_type: 'visitor',
      body: body.body.trim(),
      attachment_url: body.attachment_url,
    })

    // Trigger AI reply if enabled (async, don't block response)
    if (session.ai_enabled) {
      import('@/lib/services/ai.service').then(({ handleAIReply }) => {
        handleAIReply(id, session.entity_id).catch(err => console.error('AI reply error:', err))
      })
    }

    return NextResponse.json(message, { status: 201, headers: corsHeaders })
  } catch (err: any) {
    console.error('Widget message error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
