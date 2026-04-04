'use client'
import { useEffect, useState } from 'react'
import { Toaster, toast } from '@relentify/ui'

interface KpiData {
  thisMonth: { revenue: number; expenses: number; netProfit: number; invoiceCount: number }
  growth: { revenueGrowth: number | null; lastMonthRevenue: number }
  ytd: { revenue: number; expenses: number; netProfit: number }
  ratios: { profitMargin: number | null; expenseRatio: number | null; debtorDays: number | null; avgDaysToPayment: number; avgInvoiceValue: number }
  outstanding: { receivables: number; unpaidInvoiceCount: number; overdueBills: number }
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(n: number | null, decimals = 1) {
  if (n === null) return '—'
  return `${n.toFixed(decimals)}%`
}

function days(n: number | null) {
  if (n === null || n === 0) return '—'
  return `${Math.round(n)}d`
}

function KpiCard({ label, value, sub, color = 'text-[var(--theme-text)]', badge }: { label: string; value: string; sub?: string; color?: string; badge?: { text: string; color: string } }) {
  return (
    <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
      <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-black ${color}`}>{value}</p>
        {badge && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mb-0.5 ${badge.color}`}>{badge.text}</span>}
      </div>
      {sub && <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-3">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

export default function KpiPage() {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/kpi')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast('Failed to load KPIs', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <div className="flex items-center justify-center py-20">
        <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      </div>
    </div>
  )

  const d = data!
  const growthPositive = (d.growth.revenueGrowth ?? 0) >= 0

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">KPI Analysis</h2>
          <p className="text-[var(--theme-text-muted)] text-sm mt-1">Key performance indicators from your financial data</p>
        </div>

        <Section title="This Month">
          <KpiCard label="Revenue" value={fmt(d.thisMonth.revenue)} color="text-[var(--theme-accent)]"
            badge={d.growth.revenueGrowth !== null ? { text: `${growthPositive ? '↑' : '↓'} ${Math.abs(d.growth.revenueGrowth).toFixed(1)}% vs last month`, color: growthPositive ? 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' : 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]' } : undefined} />
          <KpiCard label="Expenses" value={fmt(d.thisMonth.expenses)} color="text-[var(--theme-destructive)]" />
          <KpiCard label="Net Profit" value={fmt(d.thisMonth.netProfit)}
            color={d.thisMonth.netProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}
            sub={d.thisMonth.netProfit < 0 ? 'Loss' : 'Profit'} />
          <KpiCard label="Invoices Created" value={`${d.thisMonth.invoiceCount}`} sub="This month" />
        </Section>

        <Section title="Year to Date">
          <KpiCard label="YTD Revenue" value={fmt(d.ytd.revenue)} color="text-[var(--theme-accent)]" />
          <KpiCard label="YTD Expenses" value={fmt(d.ytd.expenses)} color="text-[var(--theme-destructive)]" />
          <KpiCard label="YTD Net Profit" value={fmt(d.ytd.netProfit)}
            color={d.ytd.netProfit >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'} />
          <KpiCard label="Profit Margin" value={pct(d.ratios.profitMargin)}
            color={d.ratios.profitMargin !== null && d.ratios.profitMargin >= 20 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-warning)]'}
            sub="(Revenue − Expenses) / Revenue" />
        </Section>

        <Section title="Ratios &amp; Efficiency">
          <KpiCard label="Expense Ratio" value={pct(d.ratios.expenseRatio)}
            color={d.ratios.expenseRatio !== null && d.ratios.expenseRatio > 80 ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-text)]'}
            sub="Expenses / Revenue" />
          <KpiCard label="Debtor Days" value={days(d.ratios.debtorDays)}
            color={d.ratios.debtorDays !== null && d.ratios.debtorDays > 45 ? 'text-[var(--theme-warning)]' : 'text-[var(--theme-text)]'}
            sub="How long clients take to pay (avg)" />
          <KpiCard label="Avg Days to Pay" value={days(d.ratios.avgDaysToPayment)}
            sub="Sent → paid (historical avg)" />
          <KpiCard label="Avg Invoice Value" value={fmt(d.ratios.avgInvoiceValue)}
            sub="All paid invoices" />
        </Section>

        <Section title="Outstanding">
          <KpiCard label="Receivables" value={fmt(d.outstanding.receivables)}
            color={d.outstanding.receivables > 0 ? 'text-[var(--theme-warning)]' : 'text-[var(--theme-accent)]'}
            sub={`${d.outstanding.unpaidInvoiceCount} unpaid invoice${d.outstanding.unpaidInvoiceCount !== 1 ? 's' : ''}`} />
          <KpiCard label="Overdue Bills" value={fmt(d.outstanding.overdueBills)}
            color={d.outstanding.overdueBills > 0 ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-accent)]'}
            sub="Bills past due date" />
        </Section>
      </main>
    </div>
  )
}
