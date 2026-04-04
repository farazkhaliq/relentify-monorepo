import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllMaintenanceRequests, createMaintenanceRequest } from '@/lib/services/crm/maintenance.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const requests = await getAllMaintenanceRequests(auth.activeEntityId)
    return NextResponse.json(requests)
  } catch (error) {
    console.error('GET /api/maintenance error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const request = await createMaintenanceRequest({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'MaintenanceRequest', request.id, request.title || 'Maintenance Request')
    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('POST /api/maintenance error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
