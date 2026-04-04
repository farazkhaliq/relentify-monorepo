'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Label } from '@relentify/ui'
import { Check, X, Lock, Clock } from 'lucide-react'

interface Entry {
  id: string; worker_user_id: string; clock_in_at: string; clock_out_at: string | null
  total_worked_minutes: number; overtime_minutes: number; trust_score: number
  status: string; is_within_geofence_in: boolean | null; auto_clocked_out: boolean
  deduction_minutes: number; worker_name?: string; site_name?: string
}

function formatMinutes(m: number): string {
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function ApprovalsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectDialog, setRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/entries?status=pending_approval&limit=100')
    const data = await res.json()
    // Enrich with worker names
    const workersRes = await fetch('/api/workers')
    const workersData = await workersRes.json()
    const workerMap = new Map((workersData.workers || []).map((w: { worker_user_id: string; full_name: string }) => [w.worker_user_id, w.full_name]))
    const enriched = (data.entries || []).map((e: Entry) => ({ ...e, worker_name: workerMap.get(e.worker_user_id) || 'Unknown' }))
    setEntries(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleApprove = async (id: string) => {
    await fetch(`/api/entries/${id}/approve`, { method: 'POST' })
    fetchEntries()
  }

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason) return
    await fetch(`/api/entries/${rejectDialog}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    setRejectDialog(null)
    setRejectReason('')
    fetchEntries()
  }

  const handleBulkApprove = async () => {
    await fetch('/api/entries/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: Array.from(selected) }),
    })
    setSelected(new Set())
    fetchEntries()
  }

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (loading) return <div className="animate-pulse p-4">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Approvals <Badge variant="outline">{entries.length}</Badge></h1>
        {selected.size > 0 && (
          <Button onClick={handleBulkApprove}><Check size={16} className="mr-1" /> Approve {selected.size} Selected</Button>
        )}
      </div>

      {entries.length === 0 && <p className="text-[var(--theme-text-muted)]">No pending approvals.</p>}

      <div className="grid gap-3">
        {entries.map(e => {
          const trustColor = e.trust_score >= 80 ? 'text-green-600' : e.trust_score >= 50 ? 'text-amber-500' : 'text-red-500'
          return (
            <Card key={e.id} className={`p-4 ${selected.has(e.id) ? 'ring-2 ring-[var(--theme-accent)]' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} className="w-4 h-4" />
                  <div>
                    <p className="font-semibold">{e.worker_name}</p>
                    <p className="text-sm text-[var(--theme-text-muted)]">
                      {new Date(e.clock_in_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {formatMinutes(e.total_worked_minutes)}
                      {e.overtime_minutes > 0 && ` (+${formatMinutes(e.overtime_minutes)} OT)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${trustColor}`}>{e.trust_score}</span>
                  {e.auto_clocked_out && <Badge variant="destructive" className="text-xs">Auto</Badge>}
                  {e.is_within_geofence_in === false && <Badge variant="destructive" className="text-xs">Off-site</Badge>}
                  <Button variant="outline" size="sm" onClick={() => handleApprove(e.id)}><Check size={14} /></Button>
                  <Button variant="outline" size="sm" onClick={() => setRejectDialog(e.id)}><X size={14} /></Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Entry</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Reason</Label><Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why are you rejecting this entry?" /></div>
          <DialogFooter><Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
