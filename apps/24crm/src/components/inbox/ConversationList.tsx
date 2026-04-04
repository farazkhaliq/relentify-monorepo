'use client'

import { useState, useMemo } from 'react'
import { useApiDoc } from '@/hooks/use-api'
import { Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import ChannelFilter, { getChannelIcon, getChannelLabel } from './ChannelFilter'

const STATUS_COLOURS: Record<string, string> = {
  open: 'bg-[var(--theme-success)]', assigned: 'bg-[var(--theme-primary)]',
  waiting: 'bg-[var(--theme-warning)]', resolved: 'bg-[var(--theme-text-muted)]', closed: 'bg-[var(--theme-text-dim)]',
}

interface ConversationListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (channel) p.set('channel', channel)
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    return '/api/conversations?' + p.toString()
  }, [channel, status, search])

  const { data } = useApiDoc<{ conversations: any[]; total: number }>(url)
  const conversations = data?.conversations || []

  return (
    <div className="flex flex-col h-full border-r border-[var(--theme-border)]">
      <ChannelFilter selected={channel} onChange={setChannel} />
      <div className="p-2 border-b border-[var(--theme-border)] flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="text-xs rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-2 py-1">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="p-4 text-center text-sm text-[var(--theme-text-muted)]">No conversations</div>
        )}
        {conversations.map((c: any) => {
          const Icon = getChannelIcon(c.channel)
          return (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className={`w-full text-left p-3 border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)] transition-colors ${selectedId === c.id ? 'bg-[var(--theme-card)]' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-[var(--theme-text-muted)] flex-shrink-0" />
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOURS[c.status] || ''}`} />
                <span className="font-medium text-sm truncate">{c.contact_name || c.contact_email || c.contact_phone || 'Unknown'}</span>
                <span className="ml-auto text-[10px] text-[var(--theme-text-dim)] flex-shrink-0">
                  {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                </span>
              </div>
              {c.subject && <div className="text-xs text-[var(--theme-text-muted)] truncate">{c.subject}</div>}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[var(--theme-text-dim)]">{getChannelLabel(c.channel)}</span>
                {c.priority !== 'medium' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.priority === 'urgent' ? 'bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)]' : c.priority === 'high' ? 'bg-orange-100 text-orange-700' : ''}`}>
                    {c.priority}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
