'use client'

import { useState } from 'react'
import { useApiDoc, useApiCollection, apiUpdate } from '@/hooks/use-api'
import { User, Globe, Monitor, Clock, Ban, UserCog, Bot, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SessionDetail {
  id: string
  status: string
  assigned_agent_id: string | null
  agent_name: string | null
  department: string | null
  ai_enabled: boolean
  created_at: string
  resolved_at: string | null
  visitor: {
    id: string
    name: string | null
    email: string | null
    ip_address: string | null
    user_agent: string | null
    page_url: string | null
    banned: boolean
    last_seen_at: string
    custom_data: Record<string, any>
  } | null
}

interface Agent {
  id: string
  full_name: string
  email: string
}

interface VisitorSidebarProps {
  sessionId: string
}

export default function VisitorSidebar({ sessionId }: VisitorSidebarProps) {
  const { data: session, mutate: refreshSession } = useApiDoc<SessionDetail>(`/api/sessions/${sessionId}`)
  const { data: agents } = useApiCollection<Agent>('/api/agents')
  const [updating, setUpdating] = useState(false)

  if (!session) return <div className="w-72 p-4 text-sm text-[var(--theme-text-muted)]">Loading...</div>

  const v = session.visitor

  async function updateStatus(status: string) {
    setUpdating(true)
    await apiUpdate(`/api/sessions/${sessionId}`, { status })
    refreshSession()
    setUpdating(false)
  }

  async function assignAgent(agentId: string) {
    await apiUpdate(`/api/sessions/${sessionId}`, { assigned_agent_id: agentId, status: 'assigned' })
    refreshSession()
  }

  async function toggleAI() {
    await apiUpdate(`/api/sessions/${sessionId}`, { ai_enabled: !session.ai_enabled })
    refreshSession()
  }

  async function toggleBan() {
    if (!v) return
    await fetch(`/api/visitors/${v.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !v.banned }),
    })
    refreshSession()
  }

  return (
    <div className="w-72 border-l border-[var(--theme-border)] overflow-y-auto flex-shrink-0">
      {/* Visitor info */}
      <div className="p-4 border-b border-[var(--theme-border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Visitor</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User size={14} className="text-[var(--theme-text-muted)] flex-shrink-0" />
            <span className="truncate">{v?.name || 'Anonymous'}</span>
          </div>
          {v?.email && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--theme-text-muted)] flex-shrink-0 text-xs">@</span>
              <span className="truncate text-xs">{v.email}</span>
            </div>
          )}
          {v?.page_url && (
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-[var(--theme-text-muted)] flex-shrink-0" />
              <span className="truncate text-xs text-[var(--theme-text-muted)]">{v.page_url}</span>
            </div>
          )}
          {v?.ip_address && (
            <div className="flex items-center gap-2">
              <Monitor size={14} className="text-[var(--theme-text-muted)] flex-shrink-0" />
              <span className="text-xs text-[var(--theme-text-muted)]">{v.ip_address}</span>
            </div>
          )}
          {v?.last_seen_at && (
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--theme-text-muted)] flex-shrink-0" />
              <span className="text-xs text-[var(--theme-text-muted)]">
                {formatDistanceToNow(new Date(v.last_seen_at), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Session actions */}
      <div className="p-4 border-b border-[var(--theme-border)]">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Actions</h3>
        <div className="space-y-2">
          {session.status !== 'resolved' && session.status !== 'closed' && (
            <button
              onClick={() => updateStatus('resolved')}
              disabled={updating}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-success)]/10 text-[var(--theme-success)] hover:bg-[var(--theme-success)]/20"
            >
              <CheckCircle size={14} /> Resolve
            </button>
          )}
          {(session.status === 'resolved' || session.status === 'closed') && (
            <button
              onClick={() => updateStatus('open')}
              disabled={updating}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/20"
            >
              <XCircle size={14} /> Reopen
            </button>
          )}

          {/* Assign agent */}
          <div>
            <label className="text-xs text-[var(--theme-text-muted)] mb-1 block">Assign to</label>
            <select
              value={session.assigned_agent_id || ''}
              onChange={(e) => assignAgent(e.target.value)}
              className="w-full text-sm rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-2 py-1.5"
            >
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
              ))}
            </select>
          </div>

          <button
            onClick={toggleAI}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ${
              session.ai_enabled
                ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]'
                : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'
            }`}
          >
            <Bot size={14} /> {session.ai_enabled ? 'AI enabled' : 'Enable AI'}
          </button>

          <button
            onClick={toggleBan}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/20"
          >
            <Ban size={14} /> {v?.banned ? 'Unban visitor' : 'Ban visitor'}
          </button>
        </div>
      </div>

      {/* Session metadata */}
      <div className="p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Session</h3>
        <div className="space-y-1 text-xs text-[var(--theme-text-muted)]">
          <div>Status: <span className="font-medium text-[var(--theme-text)]">{session.status}</span></div>
          {session.agent_name && <div>Agent: {session.agent_name}</div>}
          {session.department && <div>Dept: {session.department}</div>}
          <div>Started: {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</div>
          {session.resolved_at && <div>Resolved: {formatDistanceToNow(new Date(session.resolved_at), { addSuffix: true })}</div>}
        </div>
      </div>
    </div>
  )
}
