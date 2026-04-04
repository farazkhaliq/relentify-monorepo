import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { banVisitor, getVisitorById } from '@/lib/services/chat/visitor.service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const banned = body.banned !== undefined ? body.banned : true

  const visitor = await getVisitorById(id, user.activeEntityId)
  if (!visitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await banVisitor(id, user.activeEntityId, banned)
  return NextResponse.json(updated)
}
