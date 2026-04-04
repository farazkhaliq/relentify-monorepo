import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from/to date parameters' }, { status: 400 })
  }

  try {
    // Fetch individual transactions for the table
    const { rows: transactions } = await pool.query(
      `SELECT id, type, amount, currency, description, transaction_date
       FROM crm_transactions
       WHERE entity_id = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
         AND type IN ('Management Fee', 'Commission', 'Agency Expense')
       ORDER BY transaction_date ASC`,
      [auth.activeEntityId, from, to]
    )

    // Calculate totals
    const income = transactions
      .filter((t: any) => ['Management Fee', 'Commission'].includes(t.type))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

    const expenses = transactions
      .filter((t: any) => t.type === 'Agency Expense')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

    return NextResponse.json({
      transactions,
      total_income: income,
      total_expenses: expenses,
      net: income - expenses,
    })
  } catch (error) {
    console.error('GET /api/reports/profit-loss error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
