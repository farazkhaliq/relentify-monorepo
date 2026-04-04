import { NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { query } from '@/src/lib/db'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const r = await query(
    `SELECT * FROM user_subscriptions WHERE user_id = $1 AND product = 'timesheets'`,
    [auth.userId]
  )

  if (!r.rows[0]) {
    return NextResponse.json({ plan: 'free', status: 'none', quantity: 0 })
  }

  const sub = r.rows[0]
  return NextResponse.json({
    plan: sub.plan,
    status: sub.status,
    quantity: sub.quantity,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
  })
}
