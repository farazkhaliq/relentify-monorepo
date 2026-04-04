import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getMaintenanceRequestById, updateMaintenanceRequest, deleteMaintenanceRequest } from '@/lib/services/crm/maintenance.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const request = await getMaintenanceRequestById(id, auth.activeEntityId)
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(request)
  } catch (error) {
    console.error('GET /api/maintenance/[id] error:', error)
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
    const request = await updateMaintenanceRequest(id, auth.activeEntityId, body)
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'MaintenanceRequest', id, request.title || 'Maintenance Request', body)
    return NextResponse.json(request)
  } catch (error) {
    console.error('PATCH /api/maintenance/[id] error:', error)
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
    const request = await getMaintenanceRequestById(id, auth.activeEntityId)
    const deleted = await deleteMaintenanceRequest(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (request) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'MaintenanceRequest', id, request.title || 'Maintenance Request')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/maintenance/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
