'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Badge, Input, Label } from '@relentify/ui'
import { Download } from 'lucide-react'

type Tab = 'hours' | 'attendance' | 'payroll' | 'leakage'

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('hours')
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<Record<string, unknown>[] | Record<string, unknown> | null>(null)

  useEffect(() => {
    const endpoint = tab === 'payroll' ? `/api/reports/payroll-summary?periodStart=${dateFrom}&periodEnd=${dateTo}`
      : tab === 'leakage' ? `/api/reports/gps?dateFrom=${dateFrom}&dateTo=${dateTo}`
      : `/api/reports/${tab}?dateFrom=${dateFrom}&dateTo=${dateTo}`
    fetch(endpoint).then(r => r.json()).then(d => setData(d.payroll || d.data || d))
  }, [tab, dateFrom, dateTo])

  const handleExport = () => {
    window.open(`/api/reports/export?type=${tab === 'leakage' ? 'hours' : tab}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'hours', label: 'Hours' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'leakage', label: 'Wage & Attendance' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button variant="outline" onClick={handleExport}><Download size={16} className="mr-1" /> Export CSV</Button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map(t => (
          <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm" onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
      </div>

      {tab === 'leakage' && data && !Array.isArray(data) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Card className="p-3 text-center"><p className="text-2xl font-bold text-green-600">£{(data as Record<string, number>).estimatedSavings}</p><p className="text-xs text-[var(--theme-text-muted)]">Estimated Savings</p></Card>
          <Card className="p-3 text-center"><p className="text-xl font-semibold">{(data as Record<string, number>).lateArrivals}</p><p className="text-xs text-[var(--theme-text-muted)]">Late Arrivals</p></Card>
          <Card className="p-3 text-center"><p className="text-xl font-semibold">{(data as Record<string, number>).lowTrustEntries}</p><p className="text-xs text-[var(--theme-text-muted)]">Low Trust</p></Card>
        </div>
      )}

      {Array.isArray(data) && data.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--theme-border)]">
              {Object.keys(data[0]).map(k => <th key={k} className="p-2 text-left font-medium text-[var(--theme-text-muted)]">{k.replace(/_/g, ' ')}</th>)}
            </tr></thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-[var(--theme-border)]">
                  {Object.values(row).map((v, j) => <td key={j} className="p-2">{String(v ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {Array.isArray(data) && data.length === 0 && <p className="text-[var(--theme-text-muted)]">No data for this period.</p>}
    </div>
  )
}
