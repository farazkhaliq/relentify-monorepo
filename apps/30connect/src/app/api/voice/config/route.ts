import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getVoiceConfig, upsertVoiceConfig } from '@/lib/services/voice.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await getVoiceConfig(user.activeEntityId)
  return NextResponse.json(config || {})
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const config = await upsertVoiceConfig(user.activeEntityId, body)
  return NextResponse.json(config)
}
