import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllDocuments, createDocument } from '@/lib/services/crm/documents.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const docs = await getAllDocuments(auth.activeEntityId)
    return NextResponse.json(docs)
  } catch (error) {
    console.error('GET /api/documents error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const doc = await createDocument({
      ...body,
      entity_id: auth.activeEntityId,
      user_id: auth.userId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Document', doc.id, doc.name)
    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('POST /api/documents error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
