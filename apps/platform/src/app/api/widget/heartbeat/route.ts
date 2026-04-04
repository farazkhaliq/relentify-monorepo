import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import pool from '@/lib/pool'
import { checkRateLimit } from '@/lib/rate-limit'
import { evaluateTriggers } from '@/lib/services/chat/trigger.service'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { visitor_id, page_url, session_id, entity_id, time_on_page, visit_count, referrer } = body

    if (!visitor_id) {
      return NextResponse.json({ error: 'visitor_id is required' }, { status: 400, headers: corsHeaders })
    }

    await pool.query(
      'UPDATE chat_visitors SET last_seen_at = NOW(), page_url = COALESCE($1, page_url) WHERE id = $2',
      [page_url || null, visitor_id]
    )

    // Evaluate triggers if session context provided
    let actions: any[] = []
    if (session_id && entity_id) {
      actions = await evaluateTriggers(entity_id, session_id, {
        time_on_page: time_on_page || 0,
        page_url: page_url || '',
        visit_count: visit_count || 1,
        referrer: referrer || '',
      })
    }

    return NextResponse.json({ ok: true, actions }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Heartbeat error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
