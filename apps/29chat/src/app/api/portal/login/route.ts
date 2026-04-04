import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { sign } from 'jsonwebtoken'
import pool from '@/lib/pool'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, entity_id } = body

    if (!email || !entity_id) {
      return NextResponse.json({ error: 'Email and entity_id required' }, { status: 400, headers: corsHeaders })
    }

    // Find visitor by email
    const visitor = await pool.query(
      'SELECT * FROM chat_visitors WHERE email = $1 AND entity_id = $2 LIMIT 1',
      [email, entity_id]
    )

    if (!visitor.rows[0]) {
      // Don't reveal if email exists — return success either way
      return NextResponse.json({ success: true, message: 'If this email exists, a login link has been sent.' }, { headers: corsHeaders })
    }

    // Generate magic link token (15min expiry)
    const token = sign(
      { visitor_id: visitor.rows[0].id, email, entity_id },
      process.env.JWT_SECRET || 'fallback-dev-secret',
      { expiresIn: '15m' }
    )

    // In production, send email. For now, log to console.
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/portal/verify?token=${token}`
    console.log(`[Portal] Magic link for ${email}: ${magicLink}`)

    return NextResponse.json({ success: true, message: 'If this email exists, a login link has been sent.' }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Portal login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}
