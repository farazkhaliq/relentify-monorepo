import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSLAPolicies, saveSLAPolicies } from '@/lib/services/sla.service'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const policies = await getSLAPolicies(user.activeEntityId)
  return NextResponse.json(policies)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const policies = await getSLAPolicies(user.activeEntityId)
  const newPolicy = { ...body, id: uuidv4() }
  policies.push(newPolicy)
  await saveSLAPolicies(user.activeEntityId, policies)
  return NextResponse.json(newPolicy, { status: 201 })
}
