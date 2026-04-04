import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { getAnalytics } from '@/lib/services/analytics.service'

export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const now = new Date()
  const from = sp.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to = sp.get('to') || now.toISOString()

  const data = await getAnalytics(apiKey.entity_id, from, to)
  return NextResponse.json(data)
}
