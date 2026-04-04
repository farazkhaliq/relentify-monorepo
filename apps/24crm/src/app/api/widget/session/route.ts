import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getOrCreateVisitor } from '@/lib/services/chat/visitor.service'
import { createSession } from '@/lib/services/chat/session.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { entity_id, fingerprint, name, email, user_agent, page_url, department } = body

    if (!entity_id || !fingerprint) {
      return NextResponse.json({ error: 'entity_id and fingerprint are required' }, { status: 400, headers: corsHeaders })
    }

    const visitor = await getOrCreateVisitor(entity_id, fingerprint, {
      name, email, ip_address: ip, user_agent, page_url,
    })

    if (visitor.banned) {
      return NextResponse.json({ error: 'Visitor is banned' }, { status: 403, headers: corsHeaders })
    }

    const session = await createSession(entity_id, visitor.id, { department })

    return NextResponse.json({ session, visitor }, { status: 201, headers: corsHeaders })
  } catch (err: any) {
    console.error('Widget session error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
