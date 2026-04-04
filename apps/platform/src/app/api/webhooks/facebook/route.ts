import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, processWebhook } from '@/lib/services/connect/facebook.service'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams)
  const result = await pool.query(
    `SELECT config->>'verify_token' as verify_token FROM connect_channels
     WHERE channel_type IN ('facebook','instagram') AND enabled = TRUE LIMIT 1`
  )
  const verifyToken = result.rows[0]?.verify_token || ''

  const challenge = verifyWebhook(sp, verifyToken)
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    await processWebhook(payload)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Facebook webhook error:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }
}
