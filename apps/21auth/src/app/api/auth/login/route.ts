import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'
import { comparePassword, generateToken, setAuthCookie } from '@/src/lib/auth'

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
    const token = generateToken({ userId: user.id, email: user.email, userType: user.user_type, fullName: user.full_name })
    const res = NextResponse.json({ user: { id: user.id, email: user.email } })
    res.headers.set('Set-Cookie', setAuthCookie(token)['Set-Cookie'])
    return res
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}