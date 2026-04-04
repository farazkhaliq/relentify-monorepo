import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/pool'
import { checkSLAs } from '@/lib/services/chat/sla.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all entities with chat_config
  const entities = await pool.query('SELECT entity_id FROM chat_config')
  const results: any[] = []

  for (const row of entities.rows) {
    const result = await checkSLAs(row.entity_id)
    if (result.breaches.length > 0) {
      results.push({ entity_id: row.entity_id, breaches: result.breaches.length })
    }
  }

  return NextResponse.json({ checked: entities.rows.length, breaches: results })
}
