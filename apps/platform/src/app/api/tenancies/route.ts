import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllTenancies, createTenancy } from '@/lib/services/crm/tenancies.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const tenancies = await getAllTenancies(auth.activeEntityId)
    return NextResponse.json(tenancies)
  } catch (error) {
    console.error('GET /api/tenancies error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const tenancy = await createTenancy({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Tenancy', tenancy.id, tenancy.property_address || 'Tenancy')
    return NextResponse.json(tenancy, { status: 201 })
  } catch (error) {
    console.error('POST /api/tenancies error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
