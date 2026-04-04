import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getAllBankAccounts, createBankAccount } from '@/lib/services/crm/bank-accounts.service'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const accounts = await getAllBankAccounts(auth.activeEntityId)
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('GET /api/bank-accounts error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const account = await createBankAccount({
      ...body,
      entity_id: auth.activeEntityId,
    })
    await logAuditEvent(auth.activeEntityId, auth.userId, 'Create', 'BankAccount', account.id, account.account_name)
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('POST /api/bank-accounts error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
