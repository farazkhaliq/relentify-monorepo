'use client'

import { useState, useMemo } from 'react'
import { useApiDoc } from '@/hooks/use-api'
import SessionFilters from './SessionFilters'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  status: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_page_url: string | null
  updated_at: string
  department: string | null
}

interface SessionListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-[var(--theme-success)]',
  assigned: 'bg-[var(--theme-primary)]',
  waiting: 'bg-[var(--theme-warning)]',
  resolved: 'bg-[var(--theme-text-muted)]',
  closed: 'bg-[var(--theme-text-dim)]',
}

export default function SessionList({ selectedId, onSelect }: SessionListProps) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    return '/api/sessions?' + params.toString()
  }, [status, search])

  const { data } = useApiDoc<{ sessions: Session[]; total: number }>(url)
  const sessions = data?.sessions || []

  return (
    <div className="flex flex-col h-full border-r border-[var(--theme-border)]">
      <SessionFilters status={status} search={search} onStatusChange={setStatus} onSearchChange={setSearch} />
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <div className="p-4 text-center text-sm text-[var(--theme-text-muted)]">No conversations</div>
        )}
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left p-3 border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)] transition-colors ${
              selectedId === s.id ? 'bg-[var(--theme-card)]' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOURS[s.status] || ''}`} />
              <span className="font-medium text-sm truncate">{s.visitor_name || s.visitor_email || 'Anonymous'}</span>
              <span className="ml-auto text-[10px] text-[var(--theme-text-dim)] flex-shrink-0">
                {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
              </span>
            </div>
            {s.department && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-border)] text-[var(--theme-text-muted)]">
                {s.department}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
