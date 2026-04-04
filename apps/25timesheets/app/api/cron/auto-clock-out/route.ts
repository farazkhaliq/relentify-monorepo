import { NextRequest, NextResponse } from 'next/server'
import { processAutoClockOuts } from '@/src/lib/auto-clock-out.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await processAutoClockOuts()
  return NextResponse.json({ ...result, timestamp: new Date().toISOString() })
}
