import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getSLAPolicies, saveSLAPolicies } from '@/lib/services/sla.service'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const policies = await getSLAPolicies(user.activeEntityId)
  const idx = policies.findIndex(p => p.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  policies[idx] = { ...policies[idx], ...body, id }
  await saveSLAPolicies(user.activeEntityId, policies)
  return NextResponse.json(policies[idx])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const policies = await getSLAPolicies(user.activeEntityId)
  const filtered = policies.filter(p => p.id !== id)
  if (filtered.length === policies.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await saveSLAPolicies(user.activeEntityId, filtered)
  return NextResponse.json({ success: true })
}
