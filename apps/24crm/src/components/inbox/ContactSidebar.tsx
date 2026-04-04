'use client'

import { useApiDoc, useApiCollection, apiUpdate } from '@/hooks/use-api'
import { User, Mail, Phone, Globe, CheckCircle, XCircle, Tag } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getChannelLabel } from './ChannelFilter'

interface ContactSidebarProps {
  conversationId: string
}

export default function ContactSidebar({ conversationId }: ContactSidebarProps) {
  const { data: conv, mutate } = useApiDoc<any>(`/api/conversations/${conversationId}`)
  const { data: agents } = useApiCollection<any>('/api/agents')

  if (!conv) return <div className="w-72 p-4 text-sm text-[var(--theme-text-muted)]">Loading...</div>

  async function updateStatus(status: string) {
    await apiUpdate(`/api/conversations/${conversationId}`, { status })
    mutate()
  }

  async function assignAgent(agentId: string) {
    await apiUpdate(`/api/conversations/${conversationId}`, { assigned_agent_id: agentId, status: agentId ? 'assigned' : 'open' })
    mutate()
  }

  return (
    <div className="w-72 border-l border-[var(--theme-border)] overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-[var(--theme-border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Contact</h3>
        <div className="space-y-2 text-sm">
          {conv.contact_name && <div className="flex items-center gap-2"><User size={14} className="text-[var(--theme-text-muted)]" />{conv.contact_name}</div>}
          {conv.contact_email && <div className="flex items-center gap-2"><Mail size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs truncate">{conv.contact_email}</span></div>}
          {conv.contact_phone && <div className="flex items-center gap-2"><Phone size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs">{conv.contact_phone}</span></div>}
          <div className="flex items-center gap-2"><Globe size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs">{getChannelLabel(conv.channel)}</span></div>
        </div>
      </div>

      <div className="p-4 border-b border-[var(--theme-border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Actions</h3>
        <div className="space-y-2">
          {conv.status !== 'resolved' && conv.status !== 'closed' ? (
            <button onClick={() => updateStatus('resolved')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-success)]/10 text-[var(--theme-success)]">
              <CheckCircle size={14} /> Resolve
            </button>
          ) : (
            <button onClick={() => updateStatus('open')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
              <XCircle size={14} /> Reopen
            </button>
          )}
          <div>
            <label className="text-xs text-[var(--theme-text-muted)] mb-1 block">Assign to</label>
            <select value={conv.assigned_agent_id || ''} onChange={(e) => assignAgent(e.target.value)}
              className="w-full text-sm rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-2 py-1.5">
              <option value="">Unassigned</option>
              {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Details</h3>
        <div className="space-y-1 text-xs text-[var(--theme-text-muted)]">
          <div>Status: <span className="font-medium text-[var(--theme-text)]">{conv.status}</span></div>
          <div>Priority: {conv.priority}</div>
          {conv.department && <div>Dept: {conv.department}</div>}
          <div>Started: {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}</div>
          {conv.tags?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <Tag size={10} />
              {conv.tags.map((t: string) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-border)]">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
