import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/src/lib/db'
import { sendPush } from '@/src/lib/notification.service'
import { evaluateAlerts } from '@/src/lib/alert-rules.service'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Send shift reminders (shifts starting in 15-60 min)
  const upcoming = await query(
    `SELECT ts.worker_user_id, u.full_name, s.name as site_name, ts.start_time
     FROM ts_shifts ts
     JOIN users u ON ts.worker_user_id = u.id
     LEFT JOIN ts_sites s ON ts.site_id = s.id
     WHERE ts.status = 'scheduled'
     AND ts.start_time BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '60 minutes'`
  )

  let remindersSent = 0
  for (const shift of upcoming.rows) {
    const time = new Date(shift.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    await sendPush(shift.worker_user_id, {
      title: 'Shift reminder',
      body: `Your shift${shift.site_name ? ` at ${shift.site_name}` : ''} starts at ${time}`,
      url: '/worker/shifts',
    })
    remindersSent++
  }

  // 2. Evaluate alert rules for each entity
  const entities = await query(`SELECT DISTINCT entity_id FROM ts_settings`)
  let alertsTriggered = 0
  for (const row of entities.rows) {
    alertsTriggered += await evaluateAlerts(row.entity_id)
  }

  return NextResponse.json({ remindersSent, alertsTriggered, timestamp: new Date().toISOString() })
}
