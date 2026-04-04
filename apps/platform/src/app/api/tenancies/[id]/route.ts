import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getTenancyById, updateTenancy, deleteTenancy } from '@/lib/services/crm/tenancies.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const tenancy = await getTenancyById(id, auth.activeEntityId)
    if (!tenancy) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(tenancy)
  } catch (error) {
    console.error('GET /api/tenancies/[id] error:', error)
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
    const tenancy = await updateTenancy(id, auth.activeEntityId, body)
    if (!tenancy) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'Tenancy', id, tenancy.property_address || 'Tenancy', body)
    return NextResponse.json(tenancy)
  } catch (error) {
    console.error('PATCH /api/tenancies/[id] error:', error)
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
    const tenancy = await getTenancyById(id, auth.activeEntityId)
    const deleted = await deleteTenancy(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (tenancy) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'Tenancy', id, tenancy.property_address || 'Tenancy')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tenancies/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
