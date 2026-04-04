'use client'

import { use, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { format } from 'date-fns'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, mutate } = useSWR(`/api/portal/tickets/${id}`, fetcher)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const ticket = data?.ticket
  const messages = data?.messages || []

  async function handleSend() {
    if (!reply.trim() || sending) return
    setSending(true)
    await fetch(`/api/portal/tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply.trim() }),
    })
    setReply('')
    setSending(false)
    mutate()
  }

  if (!ticket) return <div className="min-h-screen flex items-center justify-center text-[var(--theme-text-muted)]">Loading...</div>

  return (
    <div className="min-h-screen bg-[var(--theme-background)] p-6">
      <div className="max-w-2xl mx-auto">
        <a href="/portal/dashboard" className="flex items-center gap-1 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] mb-4">
          <ArrowLeft size={14} /> Back to tickets
        </a>

        <h1 className="text-xl font-bold mb-1">{ticket.subject}</h1>
        <div className="text-xs text-[var(--theme-text-muted)] mb-6">Status: {ticket.status} · Priority: {ticket.priority}</div>

        <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
          <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-[var(--theme-text-muted)] py-8">No messages yet. Send the first reply below.</div>
            )}
            {messages.map((m: any) => (
              <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                m.sender_type === 'visitor'
                  ? 'bg-[var(--theme-primary)] text-white ml-auto rounded-br-sm'
                  : 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm'
              }`}>
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
    </div>
  )
}
