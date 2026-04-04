'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { MessageSquare, Search, Send, StickyNote, CheckCircle, XCircle, Mail, Phone, User } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CHANNEL_LABELS: Record<string, string> = { web: 'Web Chat', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', facebook: 'Facebook', instagram: 'Instagram', voice: 'Voice' }
const STATUS_COLOURS: Record<string, string> = { open: 'bg-[var(--theme-success)]', assigned: 'bg-[var(--theme-primary)]', waiting: 'bg-[var(--theme-warning)]', resolved: 'bg-[var(--theme-text-muted)]', closed: 'bg-[var(--theme-text-dim)]' }
const SENDER_STYLES: Record<string, string> = {
  contact: 'bg-[var(--theme-primary)] text-white ml-auto rounded-br-sm',
  agent: 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm',
  ai: 'bg-[var(--theme-card)] border border-[var(--theme-border)] mr-auto rounded-bl-sm',
  system: 'bg-[var(--theme-warning)]/20 text-[var(--theme-text)] mx-auto text-center text-xs italic',
  bot: 'bg-[var(--theme-card)] border border-dashed border-[var(--theme-border)] mr-auto rounded-bl-sm',
  note: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 mr-auto rounded-bl-sm',
}

export default function CRMInboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [channel, setChannel] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const listUrl = useMemo(() => {
    const p = new URLSearchParams()
    if (channel) p.set('channel', channel)
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    return '/api/chat/conversations?' + p.toString()
  }, [channel, status, search])

  const { data: listData } = useSWR(listUrl, fetcher, { refreshInterval: 10000 })
  const conversations = listData?.conversations || []

  const { data: conv } = useSWR(selectedId ? `/api/chat/conversations/${selectedId}` : null, fetcher)
  const { data: messages, mutate: refreshMessages } = useSWR(selectedId ? `/api/chat/conversations/${selectedId}/messages` : null, fetcher, { refreshInterval: 5000 })

  const [reply, setReply] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages?.length])

  async function handleSend() {
    if (!reply.trim() || !selectedId || sending) return
    setSending(true)
    await fetch(`/api/chat/conversations/${selectedId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply.trim(), sender_type: isNote ? 'note' : 'agent' }),
    })
    setReply(''); setIsNote(false); setSending(false); refreshMessages()
  }

  async function updateStatus(newStatus: string) {
    if (!selectedId) return
    await fetch(`/api/chat/conversations/${selectedId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    mutate(listUrl); mutate(`/api/chat/conversations/${selectedId}`)
  }

  return (
    <div className="flex h-[calc(100vh-64px)] -m-4 sm:-m-6 overflow-hidden">
      {/* Left: Conversation list */}
      <div className="w-80 flex-shrink-0 border-r border-[var(--theme-border)] flex flex-col">
        <div className="p-2 border-b border-[var(--theme-border)] flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] outline-none" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="text-xs rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-2">
            <option value="">All</option><option value="open">Open</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && <div className="p-4 text-center text-sm text-[var(--theme-text-muted)]">No conversations</div>}
          {conversations.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)] ${selectedId === c.id ? 'bg-[var(--theme-card)]' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOURS[c.status] || ''}`} />
                <span className="font-medium text-sm truncate">{c.contact_name || c.contact_email || c.contact_phone || 'Unknown'}</span>
                <span className="ml-auto text-[10px] text-[var(--theme-text-dim)]">{formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}</span>
              </div>
              <div className="text-[10px] text-[var(--theme-text-dim)]">{CHANNEL_LABELS[c.channel] || c.channel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedId && messages ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(messages || []).map((m: any) => (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${SENDER_STYLES[m.sender_type] || SENDER_STYLES.agent}`}>
                  <div className="text-[10px] font-medium text-[var(--theme-text-muted)] mb-0.5">{m.sender_type}</div>
                  <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[10px] text-[var(--theme-text-dim)] mt-1">{format(new Date(m.created_at), 'HH:mm')}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className={`border-t p-3 ${isNote ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : 'border-[var(--theme-border)]'}`}>
              {isNote && <div className="text-[11px] font-medium text-yellow-600 mb-1">Internal note</div>}
              <div className="flex items-end gap-2">
                <button onClick={() => setIsNote(!isNote)} className={`p-1.5 rounded ${isNote ? 'bg-yellow-200 text-yellow-700' : 'hover:bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>
                  <StickyNote size={16} />
                </button>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={isNote ? 'Write an internal note...' : 'Type a reply...'}
                  rows={1} className="flex-1 resize-none rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none max-h-[120px]" />
                <button onClick={handleSend} disabled={!reply.trim() || sending} className="p-2 rounded-lg bg-[var(--theme-primary)] text-white disabled:opacity-50">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--theme-text-muted)]">
            <MessageSquare size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Select a conversation from the inbox</p>
          </div>
        )}
      </div>

      {/* Right: Contact sidebar */}
      {selectedId && conv && (
        <div className="w-64 border-l border-[var(--theme-border)] overflow-y-auto flex-shrink-0 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Contact</h3>
          <div className="space-y-2 text-sm mb-4">
            {conv.contact_name && <div className="flex items-center gap-2"><User size={14} className="text-[var(--theme-text-muted)]" />{conv.contact_name}</div>}
            {conv.contact_email && <div className="flex items-center gap-2"><Mail size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs">{conv.contact_email}</span></div>}
            {conv.contact_phone && <div className="flex items-center gap-2"><Phone size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs">{conv.contact_phone}</span></div>}
          </div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--theme-text-muted)] mb-3">Actions</h3>
          {conv.status !== 'resolved' && conv.status !== 'closed' ? (
            <button onClick={() => updateStatus('resolved')} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-success)]/10 text-[var(--theme-success)] mb-2">
              <CheckCircle size={14} /> Resolve
            </button>
          ) : (
            <button onClick={() => updateStatus('open')} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] mb-2">
              <XCircle size={14} /> Reopen
            </button>
          )}
          <div className="text-xs text-[var(--theme-text-muted)] mt-4">
            <div>Status: <span className="font-medium">{conv.status}</span></div>
            <div>Channel: {CHANNEL_LABELS[conv.channel] || conv.channel}</div>
            <div>Started: {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}</div>
          </div>
        </div>
      )}
    </div>
  )
}
