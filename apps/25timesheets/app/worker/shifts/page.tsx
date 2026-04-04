'use client'

import { useState, useEffect } from 'react'
import { Card, Badge } from '@relentify/ui'
import { CalendarDays, MapPin, Clock } from 'lucide-react'

interface Shift {
  id: string; date: string; start_time: string; end_time: string
  status: string; site_name: string | null; notes: string | null
}

export default function WorkerShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/shifts/my').then(r => r.json()).then(d => {
      setShifts(d.shifts || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="animate-pulse p-4">Loading shifts...</div>

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2"><CalendarDays size={20} /> My Shifts</h1>

      {shifts.length === 0 && <p className="text-[var(--theme-text-muted)]">No upcoming shifts.</p>}

      <div className="grid gap-3">
        {shifts.map(s => {
          const shiftDate = s.date?.split('T')[0]
          const isPast = shiftDate < today
          return (
            <Card key={s.id} className={`p-4 ${isPast ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <Badge variant={s.status === 'completed' ? 'default' : s.status === 'cancelled' ? 'destructive' : 'outline'}>
                  {s.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--theme-text-muted)]">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–{new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {s.site_name && <span className="flex items-center gap-1"><MapPin size={14} /> {s.site_name}</span>}
              </div>
              {s.notes && <p className="text-xs text-[var(--theme-text-muted)] mt-1">{s.notes}</p>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
