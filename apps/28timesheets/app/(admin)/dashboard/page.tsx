'use client'

import { useState, useEffect } from 'react'
import { Card, Badge, StatsCard } from '@relentify/ui'
import { Users, Coffee, Clock, ClipboardCheck, MapPinOff, AlertTriangle } from 'lucide-react'

interface Worker { worker_user_id: string; worker_name: string; site_name: string | null; clock_in_at: string; is_on_break: boolean; is_within_geofence_in: boolean | null; trust_score: number }

function formatDuration(clockInAt: string): string {
  const ms = Date.now() - new Date(clockInAt).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function DashboardPage() {
  const [live, setLive] = useState<{ clockedIn: Worker[]; totalClockedIn: number; onBreak: number; unverifiedLocations: number }>({ clockedIn: [], totalClockedIn: 0, onBreak: 0, unverifiedLocations: 0 })
  const [summary, setSummary] = useState<{ totalHours: number; pendingApprovals: number; totalOvertime: number; missedShifts: number }>({ totalHours: 0, pendingApprovals: 0, totalOvertime: 0, missedShifts: 0 })

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/live').then(r => r.json()),
      fetch('/api/dashboard/summary').then(r => r.json()),
    ]).then(([l, s]) => { setLive(l); setSummary(s) })
    const interval = setInterval(() => {
      fetch('/api/dashboard/live').then(r => r.json()).then(setLive)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatsCard label="Clocked In" value={live.totalClockedIn} icon={Users} />
        <StatsCard label="On Break" value={live.onBreak} icon={Coffee} />
        <StatsCard label="Hours Today" value={`${Math.round(summary.totalHours / 60)}h`} icon={Clock} />
        <StatsCard label="Pending" value={summary.pendingApprovals} icon={ClipboardCheck} />
        <StatsCard label="Overtime" value={`${Math.round(summary.totalOvertime / 60)}h`} icon={AlertTriangle} />
        <StatsCard label="Unverified" value={live.unverifiedLocations} icon={MapPinOff} />
      </div>

      <h2 className="text-lg font-semibold mb-3">Currently Clocked In</h2>
      <div className="grid gap-2">
        {live.clockedIn.map(w => (
          <Card key={w.worker_user_id} className="p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{w.worker_name}</p>
              <p className="text-sm text-[var(--theme-text-muted)]">{w.site_name || 'No site'} — {formatDuration(w.clock_in_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {w.is_on_break && <Badge variant="outline">Break</Badge>}
              {w.is_within_geofence_in === false && <Badge variant="destructive">Off-site</Badge>}
              <span className={`text-xs font-mono ${w.trust_score >= 80 ? 'text-green-600' : w.trust_score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{w.trust_score}</span>
            </div>
          </Card>
        ))}
        {live.clockedIn.length === 0 && <p className="text-[var(--theme-text-muted)]">No one clocked in right now.</p>}
      </div>
    </div>
  )
}
