import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { sseManager } from '@/lib/services/chat/sse.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  const { id } = await params
  sseManager.broadcast(id, 'typing', { sender_type: 'visitor' })

  return NextResponse.json({ ok: true }, { headers: corsHeaders })
}
