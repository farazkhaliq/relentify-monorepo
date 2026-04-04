import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { rateSession } from '@/lib/services/chat/session.service'
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

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400, headers: corsHeaders })
    }

    const session = await rateSession(id, body.rating, body.comment)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Widget rate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
