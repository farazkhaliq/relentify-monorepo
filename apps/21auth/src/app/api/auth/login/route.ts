import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'
import { comparePassword, generateToken, setAuthCookie } from '@/src/lib/auth'

const PRODUCT_URLS: Record<string, string> = {
  accounting: process.env.ACCOUNTS_URL || 'https://accounting.relentify.com',
  timesheets: process.env.TIMESHEETS_URL || 'https://timesheets.relentify.com',
  crm: process.env.CRM_URL || 'https://crm.relentify.com',
  inventory: process.env.INVENTORY_URL || 'https://inventory.relentify.com',
  reminders: process.env.REMINDERS_URL || 'https://reminders.relentify.com',
  esign: process.env.ESIGN_URL || 'https://esign.relentify.com',
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    const user = rows[0]
    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    const valid = await comparePassword(password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    if (!user.is_active) return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])

    // Determine default redirect based on last-used product
    let defaultRedirect = PRODUCT_URLS.accounting + '/dashboard'
    try {
      const subResult = await pool.query(
        `SELECT product FROM user_subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [user.id]
      )
      if (subResult.rows[0]?.product) {
        const product = subResult.rows[0].product
        const baseUrl = PRODUCT_URLS[product]
        if (baseUrl) defaultRedirect = product === 'timesheets' ? baseUrl + '/worker' : baseUrl + '/dashboard'
      }
    } catch { /* fallback to accounting */ }

    const token = generateToken({ userId: user.id, email: user.email, userType: user.user_type, fullName: user.full_name })
    const res = NextResponse.json({ user: { id: user.id, email: user.email }, defaultRedirect })
    res.headers.set('Set-Cookie', setAuthCookie(token)['Set-Cookie'])
    return res
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
