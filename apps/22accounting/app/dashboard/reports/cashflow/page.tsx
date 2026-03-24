'use client'
import { useEffect, useState } from 'react'
import { Toaster, toast } from '@relentify/ui'

interface Week {
  weekStart: string
  weekEnd: string
  expectedIncome: number
  expectedExpenses: number
  net: number
  runningBalance: number
}

interface ForecastData {
  openingBalance: number
  totalIncome: number
  totalExpenses: number
  weeks: Week[]
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function CashFlowPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/cashflow')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => toast('Failed to load forecast', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const maxAbs = data ? Math.max(...data.weeks.map(w => Math.max(w.expectedIncome, w.expectedExpenses, 1))) : 1
  const balances = data?.weeks.map(w => w.runningBalance) || []
  const minBal = Math.min(...balances, data?.openingBalance ?? 0)
  const maxBal = Math.max(...balances, data?.openingBalance ?? 0)
  const balRange = maxBal - minBal || 1

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Cash Flow Forecast</h2>
          <p className="text-[var(--theme-text-muted)] text-sm mt-1">Next 90 days based on outstanding invoices and unpaid bills</p>
          <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">All figures in GBP (£). Non-GBP transactions are excluded.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Opening Balance', val: fmt(data.openingBalance), sub: data.openingBalance >= 0 ? '' : 'Overdrawn', color: 'text-[var(--theme-text)]' },
                { label: 'Expected Income', val: fmt(data.totalIncome), sub: '90 days', color: 'text-[var(--theme-accent)]' },
                { label: 'Expected Expenses', val: fmt(data.totalExpenses), sub: '90 days', color: 'text-[var(--theme-destructive)]' },
                { label: 'Closing Balance', val: fmt(data.openingBalance + data.totalIncome - data.totalExpenses), sub: 'Projected', color: (data.openingBalance + data.totalIncome - data.totalExpenses) >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]' },
              ].map(c => (
                <div key={c.label} className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-cinematic p-5">
                  <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-2">{c.label}</p>
                  <p className={`text-xl font-black ${c.color}`}>{c.val}</p>
                  {c.sub && <p className="text-[10px] text-[var(--theme-text-muted)] mt-1">{c.sub}</p>}
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">Weekly In/Out</span>
                <div className="flex items-center gap-3 text-[10px] text-[var(--theme-text-muted)]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--theme-accent)] inline-block"/><span>Income</span></span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[var(--theme-destructive)] inline-block"/><span>Expenses</span></span>
                </div>
              </div>
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                {data.weeks.map((w, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5 min-w-[36px] flex-1">
                    <div className="flex items-end gap-0.5 w-full h-32">
                      <div className="flex-1 bg-[var(--theme-accent)]/80 rounded-t-sm transition-all"
                        style={{ height: `${w.expectedIncome > 0 ? (w.expectedIncome / maxAbs) * 100 : 0}%` }} />
                      <div className="flex-1 bg-[var(--theme-destructive)] rounded-t-sm transition-all"
                        style={{ height: `${w.expectedExpenses > 0 ? (w.expectedExpenses / maxAbs) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[8px] text-[var(--theme-text-muted)] whitespace-nowrap">{shortDate(w.weekStart)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Running balance line chart (SVG) */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-6 mb-6">
              <p className="text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest mb-4">Projected Balance</p>
              <svg viewBox={`0 0 ${data.weeks.length * 40} 100`} className="w-full h-32 overflow-visible">
                {/* Zero line */}
                {minBal < 0 && (
                  <line x1="0" y1={((maxBal) / balRange) * 100} x2={data.weeks.length * 40} y2={((maxBal) / balRange) * 100}
                    stroke="currentColor" strokeWidth="0.5" className="text-[var(--theme-text)]" strokeDasharray="4 2"/>
                )}
                <polyline
                  points={data.weeks.map((w, i) => `${i * 40 + 20},${100 - ((w.runningBalance - minBal) / balRange) * 90}`).join(' ')}
                  fill="none" stroke="var(--theme-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                />
                {data.weeks.map((w, i) => (
                  <circle key={i} cx={i * 40 + 20} cy={100 - ((w.runningBalance - minBal) / balRange) * 90}
                    r="3" fill={w.runningBalance < 0 ? 'var(--theme-destructive)' : 'var(--theme-accent)'}/>
                ))}
              </svg>
              <div className="flex justify-between text-[9px] text-[var(--theme-text-muted)] mt-1">
                <span>{shortDate(data.weeks[0]?.weekStart)}</span>
                <span>{shortDate(data.weeks[data.weeks.length - 1]?.weekEnd)}</span>
              </div>
            </div>

            {/* Weekly table */}
            <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--theme-border)]/[0.05]">
                    <tr>
                      {['Week', 'Expected Income', 'Expected Expenses', 'Net', 'Running Balance'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-[var(--theme-text-muted)] uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]">
                    {data.weeks.map((w, i) => (
                      <tr key={i} className="hover:bg-[var(--theme-border)]/20 transition-colors">
                        <td className="px-5 py-3 text-[var(--theme-text-muted)] whitespace-nowrap text-xs">{shortDate(w.weekStart)} – {shortDate(w.weekEnd)}</td>
                        <td className="px-5 py-3 font-bold text-[var(--theme-accent)]">{w.expectedIncome > 0 ? fmt(w.expectedIncome) : '—'}</td>
                        <td className="px-5 py-3 font-bold text-[var(--theme-destructive)]">{w.expectedExpenses > 0 ? fmt(w.expectedExpenses) : '—'}</td>
                        <td className={`px-5 py-3 font-black ${w.net >= 0 ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-destructive)]'}`}>
                          {w.net >= 0 ? '+' : '-'}{fmt(w.net)}
                        </td>
                        <td className={`px-5 py-3 font-black ${w.runningBalance < 0 ? 'text-[var(--theme-destructive)]' : 'text-[var(--theme-text)]'}`}>
                          {w.runningBalance < 0 ? '-' : ''}{fmt(w.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
