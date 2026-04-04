import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listTemplates, createTemplate } from '@/lib/services/connect/template.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const channel = req.nextUrl.searchParams.get('channel') || undefined
  return NextResponse.json(await listTemplates(user.activeEntityId, channel))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.channel || !body.name || !body.body) return NextResponse.json({ error: 'channel, name, and body required' }, { status: 400 })
  const template = await createTemplate(user.activeEntityId, body)
  return NextResponse.json(template, { status: 201 })
}
