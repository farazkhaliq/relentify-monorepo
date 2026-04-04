import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getPublicConfig } from '@/lib/services/chat/config.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  const entityId = req.nextUrl.searchParams.get('entity_id')
  if (!entityId) {
    return NextResponse.json({ error: 'entity_id is required' }, { status: 400, headers: corsHeaders })
  }

  const config = await getPublicConfig(entityId)
  if (!config) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
  }

  return NextResponse.json(config, { headers: corsHeaders })
}
