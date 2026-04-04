import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getWorkflowRuleById, updateWorkflowRule, deleteWorkflowRule } from '@/lib/services/workflow-rules.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const rule = await getWorkflowRuleById(id, auth.activeEntityId)
    if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('GET /api/workflow-rules/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const rule = await updateWorkflowRule(id, auth.activeEntityId, body)
    if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'WorkflowRule', id, rule.name, body)
    return NextResponse.json(rule)
  } catch (error) {
    console.error('PATCH /api/workflow-rules/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const rule = await getWorkflowRuleById(id, auth.activeEntityId)
    const deleted = await deleteWorkflowRule(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rule) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'WorkflowRule', id, rule.name)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/workflow-rules/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
