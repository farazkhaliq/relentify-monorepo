import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getBotById, testBot } from '@/lib/services/connect/bot.service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bot = await getBotById(id, user.activeEntityId)
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const result = await testBot(bot, body.input || [])
  return NextResponse.json(result)
}
