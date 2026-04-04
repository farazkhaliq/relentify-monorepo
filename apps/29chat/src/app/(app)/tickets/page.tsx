'use client'

import { useState, useMemo } from 'react'
import { Plus, Ticket } from 'lucide-react'
import { useApiDoc, apiCreate } from '@/hooks/use-api'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface TicketData {
  id: string
  subject: string
  status: string
  priority: string
  department: string | null
  assigned_agent_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  medium: 'bg-[var(--theme-warning)]/10 text-[var(--theme-warning)]',
  low: 'bg-[var(--theme-text-muted)]/10 text-[var(--theme-text-muted)]',
}

const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-[var(--theme-success)]/10 text-[var(--theme-success)]',
  pending: 'bg-[var(--theme-warning)]/10 text-[var(--theme-warning)]',
  resolved: 'bg-[var(--theme-text-muted)]/10 text-[var(--theme-text-muted)]',
  closed: 'bg-[var(--theme-text-dim)]/10 text-[var(--theme-text-dim)]',
}

export default function TicketsPage() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)
    return '/api/tickets?' + params.toString()
  }, [status, priority])

  const { data, mutate } = useApiDoc<{ tickets: TicketData[]; total: number }>(url)
  const tickets = data?.tickets || []

  async function handleCreate() {
    const subject = prompt('Ticket subject:')
    if (!subject?.trim()) return
    await apiCreate('/api/tickets', { subject })
    mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Ticket size={24} className="text-[var(--theme-primary)]" />
          <div>
            <h1 className="text-2xl font-bold">Tickets</h1>
            <p className="text-sm text-[var(--theme-text-muted)]">{data?.total || 0} ticket{(data?.total || 0) !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'open', 'pending', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`text-xs px-2.5 py-1 rounded-full ${status === s ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--theme-card)] border-b border-[var(--theme-border)]">
              <th className="text-left px-4 py-2.5 font-medium">Subject</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Priority</th>
              <th className="text-left px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-[var(--theme-text-muted)]">No tickets</td></tr>
            )}
            {tickets.map(t => (
              <tr key={t.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)] cursor-pointer">
                <td className="px-4 py-2.5">
                  <Link href={`/tickets/${t.id}`} className="font-medium hover:underline">{t.subject}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOURS[t.status] || ''}`}>{t.status}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOURS[t.priority] || ''}`}>{t.priority}</span>
                </td>
                <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
