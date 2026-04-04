import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/src/lib/auth'

const VALID_TIERS = ['invoicing', 'sole_trader', 'small_business', 'medium_business', 'corporate', 'accountant']
const VALID_PRODUCTS = ['accounting', 'timesheets', 'crm', 'inventory', 'reminders', 'esign']
const PRODUCT_TO_APP: Record<string, string> = {
  accounting: 'accounts', timesheets: 'timesheets', crm: 'crm',
  inventory: 'inventory', reminders: 'reminders', esign: 'esign',
}

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  const allowed = origin.endsWith('.relentify.com') || origin === 'https://relentify.com'
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req)
  try {
    const { email, password, fullName, tier, userType, firmName, affiliateId, refToken, product } = await req.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400, headers: cors })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400, headers: cors })
    }

    const isAccountant = userType === 'accountant'
    const selectedTier = isAccountant ? 'accountant' : (VALID_TIERS.includes(tier) ? tier : 'invoicing')
    const resolvedUserType = isAccountant ? 'accountant' : 'sole_trader'
    const selectedProduct = VALID_PRODUCTS.includes(product) ? product : 'accounting'

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409, headers: cors })
    }

    const hash = await hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, user_type, tier, affiliate_id, business_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, user_type, full_name, tier`,
      [email.toLowerCase(), hash, fullName, resolvedUserType, selectedTier, affiliateId || null, (isAccountant && firmName) ? firmName : null]
    )
    const user = rows[0]

    // Grant access to the selected product + always grant accounts
    const appKey = PRODUCT_TO_APP[selectedProduct] || 'accounts'
    await pool.query('INSERT INTO app_access (user_id, app) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, appKey])
    if (appKey !== 'accounts') {
      await pool.query('INSERT INTO app_access (user_id, app) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, 'accounts'])
    }

    // Create subscription record
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 31)
    await pool.query(
      `INSERT INTO user_subscriptions (user_id, product, plan, status, trial_ends_at)
       VALUES ($1, $2, $3, 'trialing', $4) ON CONFLICT (user_id, product) DO NOTHING`,
      [user.id, selectedProduct, selectedProduct === 'accounting' ? selectedTier : 'free', trialEnd]
    )

    // Handle accountant invite referral
    if (refToken) {
      try {
        const inviteR = await pool.query(
          `SELECT * FROM acc_accountant_clients WHERE invite_token = $1 AND status = 'pending'`, [refToken]
        )
        const invite = inviteR.rows[0]
        if (invite && invite.invite_email.toLowerCase() === email.toLowerCase()) {
          await pool.query(
            `UPDATE acc_accountant_clients SET status = 'active', client_user_id = $1, accepted_at = NOW() WHERE invite_token = $2`,
            [user.id, refToken]
          )
          await pool.query(
            `UPDATE users SET referred_by_accountant_id = $1, referral_started_at = NOW(), referral_expires_at = NOW() + INTERVAL '36 months'
             WHERE id = $2 AND referred_by_accountant_id IS NULL`,
            [invite.accountant_user_id, user.id]
          )
        }
      } catch (e) { console.error('Referral backfill failed:', e) }
    }

    const token = generateToken({ userId: user.id, email: user.email, userType: user.user_type, fullName: user.full_name, tier: user.tier })
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, tier: user.tier },
      product: selectedProduct,
      requiresPayment: !isAccountant && selectedTier !== 'invoicing',
    }, { status: 201, headers: cors })
    res.headers.set('Set-Cookie', setAuthCookie(token)['Set-Cookie'])
    return res
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors })
  }
}
