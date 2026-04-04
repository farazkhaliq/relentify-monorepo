'use client'

import { useState, useEffect } from 'react'
import { Card, Badge } from '@relentify/ui'
import { FileText, Clock } from 'lucide-react'

interface Entry {
  id: string; clock_in_at: string; clock_out_at: string | null
  total_worked_minutes: number; total_break_minutes: number; overtime_minutes: number
  status: string; trust_score: number
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const mins = m % 60
  return `${h}h ${mins}m`
}

export default function WorkerTimesheetsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/entries?limit=50').then(r => r.json()).then(d => {
      setEntries(d.entries || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="animate-pulse p-4">Loading...</div>

  const totalWorked = entries.reduce((s, e) => s + (e.total_worked_minutes || 0), 0)
  const totalOvertime = entries.reduce((s, e) => s + (e.overtime_minutes || 0), 0)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText size={20} /> My Timesheets</h1>

      {entries.length > 0 && (
        <Card className="p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span>Total: <strong>{formatMinutes(totalWorked)}</strong></span>
            {totalOvertime > 0 && <span>Overtime: <strong>{formatMinutes(totalOvertime)}</strong></span>}
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {entries.map(e => (
          <Card key={e.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{new Date(e.clock_in_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <Badge variant={e.status === 'approved' ? 'default' : e.status === 'rejected' ? 'destructive' : 'outline'}>
                {e.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--theme-text-muted)]">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {new Date(e.clock_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {e.clock_out_at && <>–{new Date(e.clock_out_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>}
              </span>
              <span>{formatMinutes(e.total_worked_minutes)}</span>
              {e.overtime_minutes > 0 && <Badge variant="outline" className="text-xs">+{formatMinutes(e.overtime_minutes)} OT</Badge>}
            </div>
          </Card>
        ))}
        {entries.length === 0 && <p className="text-[var(--theme-text-muted)]">No timesheets yet.</p>}
      </div>
    </div>
  )
}
