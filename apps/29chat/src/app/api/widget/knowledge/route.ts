import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import pool from '@/lib/pool'
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

  const q = req.nextUrl.searchParams.get('q')

  let result
  if (q) {
    result = await pool.query(
      `SELECT id, title, slug, body, category, language
       FROM chat_knowledge_articles
       WHERE entity_id = $1 AND published = TRUE
         AND (title ILIKE $2 OR body ILIKE $2)
       ORDER BY sort_order ASC
       LIMIT 20`,
      [entityId, `%${q}%`]
    )
  } else {
    result = await pool.query(
      `SELECT id, title, slug, body, category, language
       FROM chat_knowledge_articles
       WHERE entity_id = $1 AND published = TRUE
       ORDER BY sort_order ASC
       LIMIT 50`,
      [entityId]
    )
  }

  return NextResponse.json(result.rows, { headers: corsHeaders })
}
