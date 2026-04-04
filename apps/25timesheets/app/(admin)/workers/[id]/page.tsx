'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@relentify/ui'

interface WorkerDetail {
  id: string; worker_user_id: string; employee_number: string | null; hourly_rate: number | null
  currency: string; employment_type: string; contracted_weekly_minutes: number | null
  can_work_overtime: boolean; overtime_rate_override: number | null; is_active: boolean
  full_name: string; email: string; notes: string | null
}

export default function WorkerDetailPage() {
  const params = useParams()
  const [worker, setWorker] = useState<WorkerDetail | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/workers/${params.id}`).then(r => r.json()).then(d => setWorker(d.worker))
  }, [params.id])

  const handleSave = async () => {
    if (!worker) return
    setSaving(true)
    await fetch(`/api/workers/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_number: worker.employee_number,
        hourly_rate: worker.hourly_rate,
        employment_type: worker.employment_type,
        contracted_weekly_minutes: worker.contracted_weekly_minutes,
        can_work_overtime: worker.can_work_overtime,
        overtime_rate_override: worker.overtime_rate_override,
        is_active: worker.is_active,
        notes: worker.notes,
      }),
    })
    setSaving(false)
  }

  if (!worker) return <div className="animate-pulse p-4">Loading...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">{worker.full_name}</h1>
      <p className="text-[var(--theme-text-muted)] mb-6">{worker.email}</p>

      <Card className="p-6">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Employee Number</Label><Input value={worker.employee_number || ''} onChange={e => setWorker(w => w ? { ...w, employee_number: e.target.value } : w)} /></div>
            <div><Label>Hourly Rate (£)</Label><Input type="number" step="0.01" value={worker.hourly_rate ?? ''} onChange={e => setWorker(w => w ? { ...w, hourly_rate: parseFloat(e.target.value) || null } : w)} /></div>
          </div>
          <div><Label>Employment Type</Label>
            <Select value={worker.employment_type} onValueChange={v => setWorker(w => w ? { ...w, employment_type: v } : w)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Contracted Weekly Hours</Label><Input type="number" value={worker.contracted_weekly_minutes ? worker.contracted_weekly_minutes / 60 : ''} onChange={e => setWorker(w => w ? { ...w, contracted_weekly_minutes: parseFloat(e.target.value) ? Math.round(parseFloat(e.target.value) * 60) : null } : w)} placeholder="e.g. 40" /></div>
          <div className="flex items-center justify-between"><Label>Can Work Overtime</Label><Switch checked={worker.can_work_overtime} onCheckedChange={v => setWorker(w => w ? { ...w, can_work_overtime: v } : w)} /></div>
          <div><Label>Overtime Rate Override</Label><Input type="number" step="0.1" value={worker.overtime_rate_override ?? ''} onChange={e => setWorker(w => w ? { ...w, overtime_rate_override: parseFloat(e.target.value) || null } : w)} placeholder="e.g. 1.5" /></div>
          <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={worker.is_active} onCheckedChange={v => setWorker(w => w ? { ...w, is_active: v } : w)} /></div>
          <div><Label>Notes</Label><Input value={worker.notes || ''} onChange={e => setWorker(w => w ? { ...w, notes: e.target.value } : w)} /></div>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Card>
    </div>
  )
}
