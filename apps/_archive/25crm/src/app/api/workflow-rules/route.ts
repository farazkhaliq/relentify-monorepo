import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllWorkflowRules, createWorkflowRule } from '@/lib/services/workflow-rules.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rules = await getAllWorkflowRules(auth.activeEntityId)
    return NextResponse.json(rules)
  } catch (error) {
    console.error('GET /api/workflow-rules error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const rule = await createWorkflowRule({
      ...body,
      entity_id: auth.activeEntityId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'WorkflowRule', rule.id, rule.name)
    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('POST /api/workflow-rules error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
