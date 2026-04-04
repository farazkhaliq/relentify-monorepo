'use client'

import { use, useState } from 'react'
import { useApiDoc, useApiCollection, apiCreate, apiUpdate } from '@/hooks/use-api'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface TicketDetail {
  id: string
  subject: string
  status: string
  priority: string
  department: string | null
  assigned_agent_id: string | null
  tags: string[]
  created_at: string
}

interface Message {
  id: string
  sender_type: string
  body: string
  created_at: string
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: ticket, mutate: refreshTicket } = useApiDoc<TicketDetail>(`/api/tickets/${id}`)
  const { data: messages, mutate: refreshMessages } = useApiCollection<Message>(`/api/tickets/${id}/messages`)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  if (!ticket) return <div className="p-4 text-[var(--theme-text-muted)]">Loading...</div>

  async function handleSend() {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      await apiCreate(`/api/tickets/${id}/messages`, { body: reply.trim() })
      setReply('')
      refreshMessages()
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(status: string) {
    await apiUpdate(`/api/tickets/${id}`, { status })
    refreshTicket()
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/tickets" className="flex items-center gap-1 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] mb-2">
          <ArrowLeft size={14} /> Back to tickets
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <div className="flex gap-2">
            {ticket.status !== 'resolved' && (
              <button onClick={() => handleStatusChange('resolved')} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--theme-success)]/10 text-[var(--theme-success)]">
                Resolve
              </button>
            )}
            {ticket.status === 'resolved' && (
              <button onClick={() => handleStatusChange('open')} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
                Reopen
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-[var(--theme-text-muted)]">
          <span>Status: {ticket.status}</span>
          <span>Priority: {ticket.priority}</span>
          <span>Created: {format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
        </div>
      </div>

      <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-[var(--theme-text-muted)] py-8">No messages yet</div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
              m.sender_type === 'visitor'
                ? 'bg-[var(--theme-primary)] text-white ml-auto rounded-br-sm'
                : 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm'
            }`}>
              <div className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender_type}</div>
              <div className="text-sm whitespace-pre-wrap">{m.body}</div>
              <div className="text-[10px] opacity-50 mt-1">{format(new Date(m.created_at), 'HH:mm')}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--theme-border)] p-3 flex gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Type a reply..."
            rows={1}
            className="flex-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none resize-none"
          />
          <button onClick={handleSend} disabled={!reply.trim() || sending} className="p-2 rounded-lg bg-[var(--theme-primary)] text-white disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
