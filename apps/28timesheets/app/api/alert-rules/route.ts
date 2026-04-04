import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { checkPermission } from '@/src/lib/workspace-auth'
import { query } from '@/src/lib/db'
import { z } from 'zod'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const r = await query(`SELECT * FROM ts_alert_rules WHERE user_id = $1 AND entity_id = $2 ORDER BY name`, [entity.user_id, entity.id])
  return NextResponse.json({ rules: r.rows })
}

const schema = z.object({
  name: z.string().min(1).max(255),
  alertType: z.enum(['off_site_duration', 'late_arrivals_week', 'overtime_budget', 'pending_approvals_age']),
  thresholdValue: z.number().positive(),
})

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = checkPermission(auth, 'settings', 'manage')
  if (denied) return denied
  const entity = await getActiveEntity(auth.userId)
  if (!entity) return NextResponse.json({ error: 'No entity' }, { status: 400 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const r = await query(
    `INSERT INTO ts_alert_rules (user_id, entity_id, name, alert_type, threshold_value)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [entity.user_id, entity.id, parsed.data.name, parsed.data.alertType, parsed.data.thresholdValue]
  )
  return NextResponse.json({ rule: r.rows[0] }, { status: 201 })
}
