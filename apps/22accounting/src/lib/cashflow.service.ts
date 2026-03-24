import { query } from './db';

export interface CashFlowWeek {
  weekStart: string
  weekEnd: string
  expectedIncome: number
  expectedExpenses: number
  net: number
  runningBalance: number
}

export async function getCashFlowForecast(userId: string, days = 90, entityId?: string) {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + days)

  const todayStr = today.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]
  const eInv = entityId ? 'AND entity_id=$4' : ''
  const eBill = entityId ? 'AND entity_id=$4' : ''

  // Current bank balance (sum of all connected accounts)
  const balRes = entityId
    ? await query(`SELECT COALESCE(SUM(balance), 0) as total FROM bank_connections WHERE user_id=$1 AND entity_id=$2 AND balance IS NOT NULL`, [userId, entityId])
    : await query(`SELECT COALESCE(SUM(balance), 0) as total FROM bank_connections WHERE user_id=$1 AND balance IS NOT NULL`, [userId])
  const openingBalance = parseFloat(balRes.rows[0]?.total || '0')

  const invParams = entityId ? [userId, todayStr, endStr, entityId] : [userId, todayStr, endStr]
  const billParams = entityId ? [userId, todayStr, endStr, entityId] : [userId, todayStr, endStr]

  // Unpaid invoices due in range (expected income) — GBP only
  const invoiceRes = await query(
    `SELECT due_date, COALESCE(SUM(total), 0) as amount
     FROM invoices WHERE user_id=$1 AND status IN ('sent','overdue') AND due_date BETWEEN $2 AND $3 ${eInv} AND currency = 'GBP'
     GROUP BY due_date ORDER BY due_date`,
    invParams
  )

  // Unpaid bills due in range (expected expenses) — GBP only
  const billRes = await query(
    `SELECT due_date, COALESCE(SUM(amount), 0) as amount
     FROM bills WHERE user_id=$1 AND status IN ('unpaid','overdue') AND due_date BETWEEN $2 AND $3 ${eBill} AND currency = 'GBP'
     GROUP BY due_date ORDER BY due_date`,
    billParams
  )

  // Map to date → amount
  const incomeByDate: Record<string, number> = {}
  for (const row of invoiceRes.rows) {
    incomeByDate[row.due_date.toISOString().split('T')[0]] = parseFloat(row.amount)
  }
  const expenseByDate: Record<string, number> = {}
  for (const row of billRes.rows) {
    expenseByDate[row.due_date.toISOString().split('T')[0]] = parseFloat(row.amount)
  }

  // Build weekly buckets
  const weeks: CashFlowWeek[] = []
  let runningBalance = openingBalance
  const current = new Date(today)

  while (current <= endDate) {
    const weekStart = new Date(current)
    const weekEnd = new Date(current)
    weekEnd.setDate(weekEnd.getDate() + 6)
    if (weekEnd > endDate) weekEnd.setTime(endDate.getTime())

    let expectedIncome = 0
    let expectedExpenses = 0

    const d = new Date(weekStart)
    while (d <= weekEnd) {
      const ds = d.toISOString().split('T')[0]
      expectedIncome += incomeByDate[ds] || 0
      expectedExpenses += expenseByDate[ds] || 0
      d.setDate(d.getDate() + 1)
    }

    const net = expectedIncome - expectedExpenses
    runningBalance += net

    weeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      expectedIncome: parseFloat(expectedIncome.toFixed(2)),
      expectedExpenses: parseFloat(expectedExpenses.toFixed(2)),
      net: parseFloat(net.toFixed(2)),
      runningBalance: parseFloat(runningBalance.toFixed(2)),
    })

    current.setDate(current.getDate() + 7)
  }

  return { openingBalance, weeks, totalIncome: parseFloat(Object.values(incomeByDate).reduce((a, b) => a + b, 0).toFixed(2)), totalExpenses: parseFloat(Object.values(expenseByDate).reduce((a, b) => a + b, 0).toFixed(2)) }
}
