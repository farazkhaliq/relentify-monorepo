import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getBankAccountById, updateBankAccount, deleteBankAccount } from '@/lib/services/crm/bank-accounts.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const account = await getBankAccountById(id, auth.activeEntityId)
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(account)
  } catch (error) {
    console.error('GET /api/bank-accounts/[id] error:', error)
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
    const account = await updateBankAccount(id, auth.activeEntityId, body)
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Update', 'BankAccount', id, account.account_name, body)
    return NextResponse.json(account)
  } catch (error) {
    console.error('PATCH /api/bank-accounts/[id] error:', error)
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
    const account = await getBankAccountById(id, auth.activeEntityId)
    const deleted = await deleteBankAccount(id, auth.activeEntityId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (account) await logAuditEvent(auth.activeEntityId, auth.userId, 'Delete', 'BankAccount', id, account.account_name)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/bank-accounts/[id] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
