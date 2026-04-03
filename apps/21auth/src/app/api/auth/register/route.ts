import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/src/lib/auth'

const VALID_TIERS = ['invoicing', 'sole_trader', 'small_business', 'medium_business', 'corporate', 'accountant']

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, tier, userType, firmName, affiliateId, refToken } = await req.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const isAccountant = userType === 'accountant'
    const selectedTier = isAccountant ? 'accountant' : (VALID_TIERS.includes(tier) ? tier : 'invoicing')
    const resolvedUserType = isAccountant ? 'accountant' : 'sole_trader'

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hash = await hashPassword(password)
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, user_type, tier, affiliate_id, business_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, user_type, full_name, tier`,
      [
        email.toLowerCase(),
        hash,
        fullName,
        resolvedUserType,
        selectedTier,
        affiliateId || null,
        (isAccountant && firmName) ? firmName : null,
      ]
    )

    const user = rows[0]

    // Grant access to accounts app for all new users
    await pool.query(
      'INSERT INTO app_access (user_id, app) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user.id, 'accounts']
    )

    // Handle accountant invite referral
    if (refToken) {
      try {
        const inviteR = await pool.query(
          `SELECT * FROM acc_accountant_clients WHERE invite_token = $1 AND status = 'pending'`,
          [refToken]
        )
        const invite = inviteR.rows[0]
        if (invite && invite.invite_email.toLowerCase() === email.toLowerCase()) {
          await pool.query(
            `UPDATE acc_accountant_clients
             SET status = 'active', client_user_id = $1, accepted_at = NOW()
             WHERE invite_token = $2`,
            [user.id, refToken]
          )
          await pool.query(
            `UPDATE users SET
               referred_by_accountant_id = $1,
               referral_started_at = NOW(),
               referral_expires_at = NOW() + INTERVAL '36 months'
             WHERE id = $2 AND referred_by_accountant_id IS NULL`,
            [invite.accountant_user_id, user.id]
          )
        }
      } catch (e) {
        console.error('Referral backfill failed:', e)
        // Non-fatal — user is already created
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      userType: user.user_type,
      fullName: user.full_name,
      tier: user.tier,
    })

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, tier: user.tier },
      requiresPayment: !isAccountant && selectedTier !== 'invoicing',
    }, { status: 201 })

    res.headers.set('Set-Cookie', setAuthCookie(token)['Set-Cookie'])
    return res
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}