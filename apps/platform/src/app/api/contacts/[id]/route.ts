import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getContactById, updateContact, deleteContact } from '@/lib/services/crm/contacts.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const contact = await getContactById(id, auth.activeEntityId)
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(contact)
  } catch (error) {
    console.error('GET /api/contacts/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const contact = await updateContact(id, auth.activeEntityId, body)
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'Contact', id, `${contact.first_name} ${contact.last_name}`, body)
    return NextResponse.json(contact)
  } catch (error) {
    console.error('PATCH /api/contacts/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const contact = await getContactById(id, auth.activeEntityId)
    const deleted = await deleteContact(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (contact) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'Contact', id, `${contact.first_name} ${contact.last_name}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/contacts/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
