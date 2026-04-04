'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@relentify/ui'
import { Plus, Trash2 } from 'lucide-react'

interface Rule { id: string; name: string; after_worked_minutes: number; break_duration_minutes: number; break_type: string; auto_deduct: boolean; is_active: boolean }

export default function BreakRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', afterHours: '6', breakMinutes: '30', breakType: 'unpaid', autoDeduct: false })

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/break-rules')
    const data = await res.json()
    setRules(data.rules || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleCreate = async () => {
    await fetch('/api/break-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, afterWorkedMinutes: Math.round(parseFloat(form.afterHours) * 60), breakDurationMinutes: parseInt(form.breakMinutes), breakType: form.breakType, autoDeduct: form.autoDeduct }),
    })
    setDialogOpen(false)
    setForm({ name: '', afterHours: '6', breakMinutes: '30', breakType: 'unpaid', autoDeduct: false })
    fetchRules()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/break-rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  if (loading) return <div className="animate-pulse p-4">Loading...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Break Rules</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus size={16} className="mr-1" /> Add Rule</Button>
      </div>
      <div className="grid gap-3">
        {rules.map(r => (
          <Card key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-[var(--theme-text-muted)] mt-1">
                After {Math.round(r.after_worked_minutes / 60)}h → {r.break_duration_minutes} min {r.break_type} break
              </p>
              <div className="flex gap-2 mt-1">
                {r.auto_deduct && <Badge variant="outline">Auto-deduct</Badge>}
                <Badge variant={r.is_active ? 'default' : 'outline'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)]"><Trash2 size={16} /></button>
          </Card>
        ))}
        {rules.length === 0 && <p className="text-[var(--theme-text-muted)]">No break rules configured.</p>}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Break Rule</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lunch after 6h" /></div>
            <div><Label>After Working (hours)</Label><Input type="number" step="0.5" value={form.afterHours} onChange={e => setForm(f => ({ ...f, afterHours: e.target.value }))} /></div>
            <div><Label>Break Duration (minutes)</Label><Input type="number" value={form.breakMinutes} onChange={e => setForm(f => ({ ...f, breakMinutes: e.target.value }))} /></div>
            <div><Label>Break Type</Label>
              <Select value={form.breakType} onValueChange={v => setForm(f => ({ ...f, breakType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between"><Label>Auto-deduct if not taken</Label><Switch checked={form.autoDeduct} onCheckedChange={v => setForm(f => ({ ...f, autoDeduct: v }))} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={!form.name}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
