import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getTransactionById, updateTransaction, deleteTransaction } from '@/lib/services/crm/transactions.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const txn = await getTransactionById(id, auth.activeEntityId)
    if (!txn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(txn)
  } catch (error) {
    console.error('GET /api/transactions/[id] error:', error)
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
    const txn = await updateTransaction(id, auth.activeEntityId, body)
    if (!txn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'Transaction', id, txn.description || txn.type, body)
    return NextResponse.json(txn)
  } catch (error) {
    console.error('PATCH /api/transactions/[id] error:', error)
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
    const txn = await getTransactionById(id, auth.activeEntityId)
    const deleted = await deleteTransaction(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (txn) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'Transaction', id, txn.description || txn.type)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/transactions/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
