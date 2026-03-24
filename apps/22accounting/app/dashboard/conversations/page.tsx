'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Conversation {
  record_type: string
  record_id: string
  last_at: string
  last_body: string
  status: 'open' | 'resolved'
  waiting_on: 'client' | 'accountant' | null
  unread_count: string  // comes as string from pg COUNT
}

const RECORD_PATHS: Record<string, (id: string) => string> = {
  bill: id => `/dashboard/bills/${id}`,
  invoice: id => `/dashboard/invoices/${id}`,
  expense: () => `/dashboard/expenses`,
  bank_transaction: () => `/dashboard/banking`,
  journal: () => `/dashboard/journals`,
}

const RECORD_LABELS: Record<string, string> = {
  bill: 'Bill', invoice: 'Invoice', expense: 'Expense',
  bank_transaction: 'Bank Transaction', journal: 'Journal',
}

export default function ConversationsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/comments/conversations', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.conversations) setConversations(d.conversations) })
      .finally(() => setLoading(false))
  }, [])

  const openConvs = conversations.filter(c => c.status === 'open')
  const resolvedConvs = conversations.filter(c => c.status === 'resolved')

  function ConvItem({ conv }: { conv: Conversation }) {
    const unread = parseInt(conv.unread_count) > 0
    return (
      <button
        onClick={() => router.push(RECORD_PATHS[conv.record_type]?.(conv.record_id) ?? '/dashboard')}
        className="w-full text-left p-4 border border-[var(--theme-border)] rounded-xl hover:bg-[var(--theme-card)] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {unread && <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] shrink-0" />}
              <span className="text-xs font-semibold text-[var(--theme-text)]">
                {RECORD_LABELS[conv.record_type] ?? conv.record_type}
              </span>
              {conv.waiting_on && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--theme-warning)]/10 text-[var(--theme-warning)] font-medium">
                  Waiting: {conv.waiting_on}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--theme-text-muted)] truncate">{conv.last_body}</p>
          </div>
          <span className="text-xs text-[var(--theme-text-dim)] shrink-0">
            {new Date(conv.last_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-[var(--theme-text)]">Conversations</h1>

      {loading ? (
        <p className="text-sm text-[var(--theme-text-dim)]">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-[var(--theme-text-muted)]">No conversations yet.</p>
      ) : (
        <>
          {openConvs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--theme-text-muted)]">Open ({openConvs.length})</h2>
              {openConvs.map(c => <ConvItem key={`${c.record_type}-${c.record_id}`} conv={c} />)}
            </div>
          )}
          {resolvedConvs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--theme-text-muted)]">Resolved ({resolvedConvs.length})</h2>
              {resolvedConvs.map(c => <ConvItem key={`${c.record_type}-${c.record_id}`} conv={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
