import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllContacts, createContact } from '@/lib/services/contacts.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contacts = await getAllContacts(auth.activeEntityId)
    return NextResponse.json(contacts)
  } catch (error) {
    console.error('GET /api/contacts error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const contact = await createContact({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Contact', contact.id, `${contact.first_name} ${contact.last_name}`)
    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('POST /api/contacts error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
