import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/src/lib/db'
import { calculateOvertime } from '@/src/lib/overtime.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  const workers = await query(
    `SELECT DISTINCT worker_user_id, entity_id FROM ts_entries
     WHERE clock_in_at::date = $1 AND clock_out_at IS NOT NULL`,
    [dateStr]
  )

  let processed = 0
  for (const row of workers.rows) {
    await calculateOvertime(row.worker_user_id, row.entity_id, dateStr)
    processed++
  }

  return NextResponse.json({ workersProcessed: processed, date: dateStr })
}
