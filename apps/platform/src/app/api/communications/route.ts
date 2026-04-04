import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllCommunications, createCommunication } from '@/lib/services/crm/communications.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const comms = await getAllCommunications(auth.activeEntityId, type)
    return NextResponse.json(comms)
  } catch (error) {
    console.error('GET /api/communications error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const comm = await createCommunication({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Communication', comm.id, comm.subject || comm.type)
    return NextResponse.json(comm, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
