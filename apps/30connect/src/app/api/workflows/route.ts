import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listWorkflows, createWorkflow } from '@/lib/services/workflow.service'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listWorkflows(user.activeEntityId))
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.name?.trim() || !body.trigger_event) return NextResponse.json({ error: 'name and trigger_event required' }, { status: 400 })
  const wf = await createWorkflow(user.activeEntityId, body)
  return NextResponse.json(wf, { status: 201 })
}
