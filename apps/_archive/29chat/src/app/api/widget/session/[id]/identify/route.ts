import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getSessionById } from '@/lib/services/session.service'
import { updateVisitor } from '@/lib/services/visitor.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  try {
    const { id } = await params
    const body = await req.json()

    const session = await getSessionById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders })
    }

    const visitor = await updateVisitor(session.visitor_id, {
      name: body.name,
      email: body.email,
    })

    return NextResponse.json(visitor, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Widget identify error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
