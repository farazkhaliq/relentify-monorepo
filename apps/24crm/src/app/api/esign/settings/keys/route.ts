import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getAuthUser } from '@/lib/auth'
import { query } from '@/lib/services/esign/db'
import { getOrCreateSubscription } from '@/lib/services/esign/subscription'
import { getApiKeyLimit } from '@/lib/services/esign/tiers'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await query(
    `SELECT id, app_id, key_prefix, label, is_active, request_count, created_at, last_used_at
     FROM esign_api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.userId]
  )

  return NextResponse.json({ keys: rows })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await getOrCreateSubscription(user.userId)
  const limit = getApiKeyLimit(sub.tier)

  // Check key limit
  const { rows: existing } = await query(
    'SELECT COUNT(*) as n FROM esign_api_keys WHERE user_id = $1 AND is_active = TRUE',
    [user.userId]
  )
  if (parseInt(existing[0].n) >= limit) {
    return NextResponse.json({
      error: `Your ${sub.tier} plan allows ${limit} API keys. Upgrade for more.`
    }, { status: 403 })
  }

  const { label, appId } = await req.json()

  // Generate key
  const rawKey = `rs_live_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.substring(0, 15)

  const { rows } = await query(
    `INSERT INTO esign_api_keys (user_id, app_id, key_hash, key_prefix, label)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, key_prefix, label, created_at`,
    [user.userId, appId || 'custom', keyHash, keyPrefix, label || null]
  )

  return NextResponse.json({
    key: rows[0],
    secretKey: rawKey, // Only shown once!
  }, { status: 201 })
}
