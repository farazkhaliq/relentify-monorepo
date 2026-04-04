'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Shift {
  id: string; date: string; start_time: string; end_time: string
  status: string; worker_name: string; site_name: string | null
}
interface Worker { id: string; worker_user_id: string; full_name: string }

function getWeekDates(offset: number): string[] {
  const now = new Date()
  now.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ workerUserId: '', date: '', startTime: '08:00', endTime: '17:00', notes: '' })

  const dates = getWeekDates(weekOffset)

  const fetchData = useCallback(async () => {
    const [sRes, wRes] = await Promise.all([
      fetch(`/api/shifts?dateFrom=${dates[0]}&dateTo=${dates[6]}`),
      fetch('/api/workers'),
    ])
    const [sData, wData] = await Promise.all([sRes.json(), wRes.json()])
    setShifts(sData.shifts || [])
    setWorkers(wData.workers || [])
  }, [dates[0], dates[6]])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreate = async () => {
    await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerUserId: form.workerUserId, date: form.date,
        startTime: `${form.date}T${form.startTime}:00`,
        endTime: `${form.date}T${form.endTime}:00`,
        notes: form.notes || undefined,
      }),
    })
    setDialogOpen(false)
    fetchData()
  }

  const handleCancel = async (id: string) => {
    await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    fetchData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus size={16} className="mr-1" /> Add Shift</Button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft size={16} /></Button>
        <span className="text-sm font-medium">{dates[0]} — {dates[6]}</span>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight size={16} /></Button>
        {weekOffset !== 0 && <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {dates.map((date, i) => {
          const dayShifts = shifts.filter(s => s.date?.split('T')[0] === date)
          const isToday = date === new Date().toISOString().split('T')[0]
          return (
            <div key={date} className={`border rounded-lg p-2 min-h-[120px] ${isToday ? 'border-[var(--theme-accent)]' : 'border-[var(--theme-border)]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isToday ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'}`}>
                  {DAY_NAMES[i]} {date.split('-')[2]}
                </span>
                <button onClick={() => { setForm(f => ({ ...f, date })); setDialogOpen(true) }} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)]"><Plus size={14} /></button>
              </div>
              <div className="grid gap-1">
                {dayShifts.map(s => (
                  <div key={s.id} className={`text-xs p-1.5 rounded ${s.status === 'cancelled' ? 'bg-[var(--theme-muted)] line-through' : 'bg-[var(--theme-accent)]/10'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{s.worker_name}</span>
                      {s.status !== 'cancelled' && <button onClick={() => handleCancel(s.id)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)]"><X size={10} /></button>}
                    </div>
                    <span className="text-[var(--theme-text-muted)]">
                      {new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–{new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Shift</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Worker</Label>
              <Select value={form.workerUserId} onValueChange={v => setForm(f => ({ ...f, workerUserId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                <SelectContent>{workers.map(w => <SelectItem key={w.worker_user_id} value={w.worker_user_id}>{w.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div><Label>End</Label><Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={!form.workerUserId || !form.date}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
