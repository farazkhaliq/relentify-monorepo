import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/api-key-auth'
import { getLiveVisitors } from '@/lib/services/chat/visitor.service'

export async function GET(req: NextRequest) {
  const apiKey = await verifyApiKey(req)
  if (!apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const visitors = await getLiveVisitors(apiKey.entity_id)
  return NextResponse.json(visitors)
}
