import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/lib/db'
import { getAuthUser } from '@/src/lib/auth'

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  const allowed = origin.endsWith('.relentify.com') || origin === 'https://relentify.com'
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req)
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const r = await pool.query('SELECT app FROM app_access WHERE user_id = $1', [auth.userId])
  const apps = r.rows.map((row: { app: string }) => row.app)

  // Map app_access keys to product names
  const APP_TO_PRODUCT: Record<string, string> = {
    accounts: 'accounting', timesheets: 'timesheets', crm: 'crm',
    inventory: 'inventory', reminders: 'reminders', esign: 'esign',
  }
  const products = apps.map((a: string) => APP_TO_PRODUCT[a] || a)

  return NextResponse.json({ apps: products }, { headers: cors })
}
