import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  try {
    const r = await pool.query(
      `SELECT ai.*, u.full_name, u.business_name
       FROM accountant_invitations ai
       JOIN users u ON u.id = ai.client_user_id
       WHERE ai.token=$1 AND ai.status='pending'`,
      [token]
    )
    if (!r.rows.length) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    const inv = r.rows[0]
    return NextResponse.json({
      valid: true,
      clientName: inv.business_name || inv.full_name,
      accountantEmail: inv.accountant_email,
    })
  } catch (e) {
    console.error('GET accept error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    // Find the invitation
    const r = await pool.query(
      `SELECT * FROM accountant_invitations WHERE token=$1 AND status='pending'`,
      [token]
    )
    if (!r.rows.length) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
    const inv = r.rows[0]

    // Find the accountant's user record by email
    const accountantUser = await pool.query(
      `SELECT id FROM users WHERE email=$1`,
      [inv.accountant_email]
    )

    const accountantUserId = accountantUser.rows[0]?.id || null

    // Link accountant to client
    await pool.query(
      `UPDATE users SET accountant_user_id=$1 WHERE id=$2`,
      [accountantUserId, inv.client_user_id]
    )

    // Mark invitation accepted
    await pool.query(
      `UPDATE accountant_invitations SET status='accepted', accepted_at=NOW() WHERE id=$1`,
      [inv.id]
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('POST accept error:', e)
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
