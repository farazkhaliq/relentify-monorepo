'use client'

import { useState } from 'react'
import { Plus, Ticket, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface TicketData {
  id: string
  subject: string
  status: string
  priority: string
  updated_at: string
}

export default function PortalDashboard() {
  const { data: tickets = [], mutate } = useSWR<TicketData[]>('/api/portal/tickets', fetcher)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    await fetch('/api/portal/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
    })
    setSubject('')
    setCreating(false)
    mutate()
  }

  return (
    <div className="min-h-screen bg-[var(--theme-background)] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Tickets</h1>
          <button onClick={() => setCreating(!creating)} className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium">
            <Plus size={16} /> New Ticket
          </button>
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="mb-6 p-4 border border-[var(--theme-border)] rounded-xl flex gap-2">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Describe your issue..."
              className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none"
              autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm">Submit</button>
          </form>
        )}

        <div className="space-y-2">
          {tickets.length === 0 && (
            <div className="text-center py-12 text-[var(--theme-text-muted)]">
              <Ticket size={36} className="mx-auto mb-3 opacity-30" />
              <p>No tickets yet</p>
            </div>
          )}
          {tickets.map(t => (
            <a key={t.id} href={`/portal/tickets/${t.id}`}
              className="block p-4 border border-[var(--theme-border)] rounded-xl hover:bg-[var(--theme-card)] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.subject}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-[var(--theme-success)]/10 text-[var(--theme-success)]' : 'bg-[var(--theme-text-muted)]/10 text-[var(--theme-text-muted)]'}`}>
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-[var(--theme-text-muted)] mt-1">
                {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
