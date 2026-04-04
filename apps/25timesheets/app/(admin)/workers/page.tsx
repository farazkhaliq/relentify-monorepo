'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@relentify/ui'
import { Plus, Upload, Users } from 'lucide-react'
import Link from 'next/link'

interface Worker {
  id: string; worker_user_id: string; employee_number: string | null; hourly_rate: number | null
  employment_type: string; is_active: boolean; full_name: string; email: string
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)

  const fetchWorkers = useCallback(async () => {
    const res = await fetch('/api/workers')
    const data = await res.json()
    setWorkers(data.workers || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/workers/import', { method: 'POST', body: formData })
    const result = await res.json()
    setImportResult(result)
    fetchWorkers()
  }

  if (loading) return <div className="animate-pulse p-4">Loading workers...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workers</h1>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" asChild><span><Upload size={16} className="mr-1" /> Import CSV</span></Button>
          </label>
        </div>
      </div>

      {workers.length < 3 && (
        <Card className="p-4 mb-6 border-[var(--theme-accent)] bg-[var(--theme-accent)]/5">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[var(--theme-accent)]" />
            <p className="text-sm">Get your team started — import a CSV or add workers one by one</p>
          </div>
        </Card>
      )}

      {importResult && (
        <Card className="p-3 mb-4">
          <p className="text-sm font-medium">Import: {importResult.created} workers created</p>
          {importResult.errors.length > 0 && (
            <ul className="text-sm text-[var(--theme-destructive)] mt-1">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-3">
        {workers.map(w => (
          <Link key={w.id} href={`/workers/${w.id}`} className="no-underline">
            <Card className="p-4 hover:bg-[var(--theme-muted)] transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{w.full_name}</p>
                  <p className="text-sm text-[var(--theme-text-muted)]">{w.email}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {w.employee_number && <Badge variant="outline">#{w.employee_number}</Badge>}
                  {w.hourly_rate && <Badge variant="outline">£{w.hourly_rate}/hr</Badge>}
                  <Badge variant={w.employment_type === 'full_time' ? 'default' : 'outline'}>
                    {w.employment_type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {workers.length === 0 && <p className="text-[var(--theme-text-muted)]">No workers yet.</p>}
      </div>
    </div>
  )
}
