'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@relentify/ui'
import { Plus, Trash2 } from 'lucide-react'

interface Rule { id: string; name: string; rule_type: string; threshold_minutes: number; multiplier: number; priority: number; is_active: boolean }

export default function OvertimeRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', ruleType: 'daily', thresholdMinutes: '480', multiplier: '1.5', priority: '0' })

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/overtime-rules')
    const data = await res.json()
    setRules(data.rules || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleCreate = async () => {
    await fetch('/api/overtime-rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, ruleType: form.ruleType, thresholdMinutes: parseInt(form.thresholdMinutes), multiplier: parseFloat(form.multiplier), priority: parseInt(form.priority) }),
    })
    setDialogOpen(false)
    setForm({ name: '', ruleType: 'daily', thresholdMinutes: '480', multiplier: '1.5', priority: '0' })
    fetchRules()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/overtime-rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  if (loading) return <div className="animate-pulse p-4">Loading...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Overtime Rules</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus size={16} className="mr-1" /> Add Rule</Button>
      </div>
      <div className="grid gap-3">
        {rules.map(r => (
          <Card key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{r.name}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{r.rule_type}</Badge>
                <Badge variant="outline">After {Math.round(r.threshold_minutes / 60)}h</Badge>
                <Badge variant="outline">{r.multiplier}x</Badge>
                <Badge variant={r.is_active ? 'default' : 'outline'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-[var(--theme-text-muted)] hover:text-[var(--theme-destructive)]"><Trash2 size={16} /></button>
          </Card>
        ))}
        {rules.length === 0 && <p className="text-[var(--theme-text-muted)]">No overtime rules configured.</p>}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Overtime Rule</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily Over 8h" /></div>
            <div><Label>Type</Label>
              <Select value={form.ruleType} onValueChange={v => setForm(f => ({ ...f, ruleType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="consecutive_day">Consecutive Days</SelectItem><SelectItem value="night">Night</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Threshold (hours)</Label><Input type="number" value={parseInt(form.thresholdMinutes) / 60} onChange={e => setForm(f => ({ ...f, thresholdMinutes: String(Math.round(parseFloat(e.target.value) * 60)) }))} /></div>
            <div><Label>Multiplier</Label><Input type="number" step="0.1" value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate} disabled={!form.name}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
