import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCommunicationById, updateCommunication, deleteCommunication } from '@/lib/services/crm/communications.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const comm = await getCommunicationById(id, auth.activeEntityId)
    if (!comm) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(comm)
  } catch (error) {
    console.error('GET /api/communications/[id] error:', error)
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
    const comm = await updateCommunication(id, auth.activeEntityId, body)
    if (!comm) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'Communication', id, comm.subject || comm.type, body)
    return NextResponse.json(comm)
  } catch (error) {
    console.error('PATCH /api/communications/[id] error:', error)
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
    const comm = await getCommunicationById(id, auth.activeEntityId)
    const deleted = await deleteCommunication(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (comm) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'Communication', id, comm.subject || comm.type)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/communications/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
