'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, Badge } from '@relentify/ui'
import { MapPin, Clock, Shield, Coffee } from 'lucide-react'

interface Entry {
  id: string; clock_in_at: string; clock_out_at: string | null
  clock_in_latitude: number | null; clock_in_longitude: number | null
  clock_out_latitude: number | null; clock_out_longitude: number | null
  total_worked_minutes: number; total_break_minutes: number; overtime_minutes: number
  deduction_minutes: number; deduction_reason: string | null
  trust_score: number; status: string; approved_by: string | null; approved_at: string | null
  rejection_reason: string | null; auto_clocked_out: boolean
  is_within_geofence_in: boolean | null; is_within_geofence_out: boolean | null
  gps_ping_count: number; gps_pings_in_fence: number; gps_verification_pct: number | null
  site_id: string | null; notes: string | null
}

interface Break {
  id: string; start_at: string; end_at: string | null; break_type: string; duration_minutes: number | null
}

function formatMinutes(m: number): string {
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function EntryDetailPage() {
  const params = useParams()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [breaks, setBreaks] = useState<Break[]>([])

  useEffect(() => {
    fetch(`/api/entries/${params.id}`).then(r => r.json()).then(d => {
      setEntry(d.entry)
      setBreaks(d.breaks || [])
    })
  }, [params.id])

  if (!entry) return <div className="animate-pulse p-4">Loading...</div>

  const trustColor = entry.trust_score >= 80 ? 'text-green-600' : entry.trust_score >= 50 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Entry Detail</h1>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">{new Date(entry.clock_in_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <Badge variant={entry.status === 'approved' ? 'default' : entry.status === 'rejected' ? 'destructive' : 'outline'}>
            {entry.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span>Clock in: {new Date(entry.clock_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {entry.clock_out_at && (
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>Clock out: {new Date(entry.clock_out_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              {entry.auto_clocked_out && <Badge variant="destructive" className="text-xs">Auto</Badge>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>Worked: <strong>{formatMinutes(entry.total_worked_minutes)}</strong></span>
            {entry.overtime_minutes > 0 && <Badge variant="outline">+{formatMinutes(entry.overtime_minutes)} OT</Badge>}
          </div>
        </div>
      </Card>

      {/* GPS Info */}
      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><MapPin size={16} /> Location</h3>
        <div className="grid gap-1 text-sm">
          <div className="flex justify-between">
            <span>Clock-in geofence</span>
            <span>{entry.is_within_geofence_in === true ? 'Inside' : entry.is_within_geofence_in === false ? 'Outside' : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Clock-out geofence</span>
            <span>{entry.is_within_geofence_out === true ? 'Inside' : entry.is_within_geofence_out === false ? 'Outside' : 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>GPS pings</span>
            <span>{entry.gps_pings_in_fence}/{entry.gps_ping_count} in fence ({entry.gps_verification_pct != null ? Math.round(entry.gps_verification_pct) : 0}%)</span>
          </div>
        </div>
      </Card>

      {/* Trust Score */}
      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Shield size={16} /> Trust Score</h3>
        <div className={`text-3xl font-bold ${trustColor}`}>{entry.trust_score}/100</div>
      </Card>

      {/* Breaks */}
      {breaks.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Coffee size={16} /> Breaks ({formatMinutes(entry.total_break_minutes)})</h3>
          <div className="grid gap-1 text-sm">
            {breaks.map(b => (
              <div key={b.id} className="flex justify-between">
                <span>{new Date(b.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {b.end_at && ` – ${new Date(b.end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
                <span>{b.duration_minutes ? `${b.duration_minutes}m` : 'Active'} ({b.break_type})</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Deductions */}
      {entry.deduction_minutes > 0 && (
        <Card className="p-4 mb-4 border-[var(--theme-destructive)]">
          <h3 className="font-semibold mb-1">Deductions</h3>
          <p className="text-sm">{formatMinutes(entry.deduction_minutes)} deducted</p>
          {entry.deduction_reason && <p className="text-xs text-[var(--theme-text-muted)]">{entry.deduction_reason}</p>}
        </Card>
      )}

      {/* Approval */}
      {entry.approved_at && (
        <Card className="p-4 mb-4">
          <p className="text-sm">Approved: {new Date(entry.approved_at).toLocaleString('en-GB')}</p>
        </Card>
      )}
      {entry.rejection_reason && (
        <Card className="p-4 mb-4 border-[var(--theme-destructive)]">
          <p className="text-sm">Rejected: {entry.rejection_reason}</p>
        </Card>
      )}

      {entry.notes && (
        <Card className="p-4"><p className="text-sm">{entry.notes}</p></Card>
      )}
    </div>
  )
}
