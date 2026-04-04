import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listBots, createBot } from '@/lib/services/connect/bot.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listBots(user.activeEntityId))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const bot = await createBot(user.activeEntityId, body)
  return NextResponse.json(bot, { status: 201 })
}
