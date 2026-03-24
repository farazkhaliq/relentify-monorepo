import { query } from './db';

export async function getKpiData(userId: string, entityId?: string) {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]

  // Build entity-aware query helpers
  // $3 variants: for queries with [userId, dateParam, entityId]
  const eInv = entityId ? `AND entity_id=$3` : ''
  const eBill = entityId ? `AND entity_id=$3` : ''
  // $2 variants: for queries with only [userId, entityId]
  const eInv2 = entityId ? `AND entity_id=$2` : ''
  const eBill2 = entityId ? `AND entity_id=$2` : ''

  function invParams(...extra: unknown[]) { return entityId ? [userId, ...extra, entityId] : [userId, ...extra] }
  function billParams(...extra: unknown[]) { return entityId ? [userId, ...extra, entityId] : [userId, ...extra] }

  const [
    thisMonthRevenue,
    lastMonthRevenue,
    thisMonthExpenses,
    ytdRevenue,
    ytdExpenses,
    outstandingReceivables,
    overdueBills,
    avgInvoiceValue,
    avgDaysToPayment,
    invoiceCountThisMonth,
    unpaidInvoiceCount,
  ] = await Promise.all([
    // This month revenue (paid invoices)
    query(`SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' AND paid_at >= $2 ${eInv}`, invParams(thisMonthStart)),
    // Last month revenue
    entityId
      ? query(`SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' AND paid_at BETWEEN $2 AND $3 AND entity_id=$4`, [userId, lastMonthStart, lastMonthEnd, entityId])
      : query(`SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' AND paid_at BETWEEN $2 AND $3`, [userId, lastMonthStart, lastMonthEnd]),
    // This month expenses (bills due)
    query(`SELECT COALESCE(SUM(amount), 0) as val FROM bills WHERE user_id=$1 AND due_date >= $2 ${eBill}`, billParams(thisMonthStart)),
    // YTD revenue
    query(`SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' AND paid_at >= $2 ${eInv}`, invParams(yearStart)),
    // YTD expenses
    query(`SELECT COALESCE(SUM(amount), 0) as val FROM bills WHERE user_id=$1 AND due_date >= $2 ${eBill}`, billParams(yearStart)),
    // Outstanding receivables (unpaid sent invoices)
    query(`SELECT COALESCE(SUM(total), 0) as val FROM invoices WHERE user_id=$1 AND status IN ('sent','overdue') ${eInv2}`, entityId ? [userId, entityId] : [userId]),
    // Overdue bills total
    query(`SELECT COALESCE(SUM(amount), 0) as val FROM bills WHERE user_id=$1 AND status='overdue' ${eBill2}`, entityId ? [userId, entityId] : [userId]),
    // Avg invoice value (all time)
    query(`SELECT COALESCE(AVG(total), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' ${eInv2}`, entityId ? [userId, entityId] : [userId]),
    // Avg days to payment (sent_at → paid_at)
    query(`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (paid_at - sent_at)) / 86400), 0) as val FROM invoices WHERE user_id=$1 AND status='paid' AND sent_at IS NOT NULL AND paid_at IS NOT NULL ${eInv2}`, entityId ? [userId, entityId] : [userId]),
    // Invoice count this month
    query(`SELECT COUNT(*) as val FROM invoices WHERE user_id=$1 AND created_at >= $2 ${eInv}`, invParams(thisMonthStart)),
    // Unpaid invoice count
    query(`SELECT COUNT(*) as val FROM invoices WHERE user_id=$1 AND status IN ('sent','overdue') ${eInv2}`, entityId ? [userId, entityId] : [userId]),
  ])

  const revenue = parseFloat(thisMonthRevenue.rows[0].val)
  const expenses = parseFloat(thisMonthExpenses.rows[0].val)
  const lastRevenue = parseFloat(lastMonthRevenue.rows[0].val)
  const ytdRev = parseFloat(ytdRevenue.rows[0].val)
  const ytdExp = parseFloat(ytdExpenses.rows[0].val)

  const revenueGrowth = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : null
  const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : null
  const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : null

  // Debtor days = (outstanding / annualised revenue) * 365
  const annualisedRevenue = ytdRev > 0 ? (ytdRev / dayOfYear(now)) * 365 : 0
  const debtorDays = annualisedRevenue > 0 ? (parseFloat(outstandingReceivables.rows[0].val) / annualisedRevenue) * 365 : null

  return {
    thisMonth: {
      revenue,
      expenses,
      netProfit: revenue - expenses,
      invoiceCount: parseInt(invoiceCountThisMonth.rows[0].val),
    },
    growth: {
      revenueGrowth,
      lastMonthRevenue: lastRevenue,
    },
    ytd: {
      revenue: ytdRev,
      expenses: ytdExp,
      netProfit: ytdRev - ytdExp,
    },
    ratios: {
      profitMargin,
      expenseRatio,
      debtorDays,
      avgDaysToPayment: parseFloat(avgDaysToPayment.rows[0].val),
      avgInvoiceValue: parseFloat(avgInvoiceValue.rows[0].val),
    },
    outstanding: {
      receivables: parseFloat(outstandingReceivables.rows[0].val),
      unpaidInvoiceCount: parseInt(unpaidInvoiceCount.rows[0].val),
      overdueBills: parseFloat(overdueBills.rows[0].val),
    },
  }
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}
