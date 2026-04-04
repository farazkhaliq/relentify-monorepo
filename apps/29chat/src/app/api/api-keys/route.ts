import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listApiKeys, createApiKey } from '@/lib/api-key-auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const keys = await listApiKeys(user.activeEntityId)
  return NextResponse.json(keys)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const result = await createApiKey(user.activeEntityId, body.name, body.scopes)
  return NextResponse.json(result, { status: 201 })
}
