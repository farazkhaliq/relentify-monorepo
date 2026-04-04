import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllTransactions, createTransaction } from '@/lib/services/crm/transactions.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const contactId = req.nextUrl.searchParams.get('contact_id') || undefined
    const transactions = await getAllTransactions(auth.activeEntityId, type, contactId)
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('GET /api/transactions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const txn = await createTransaction({
      ...body,
      entity_id: auth.activeEntityId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'Transaction', txn.id, txn.description || txn.type)
    return NextResponse.json(txn, { status: 201 })
  } catch (error) {
    console.error('POST /api/transactions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
