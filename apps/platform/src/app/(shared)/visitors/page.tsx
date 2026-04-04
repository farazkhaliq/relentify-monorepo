'use client'

import { useApiCollection } from '@/hooks/use-api'
import { useSSE } from '@/hooks/use-sse'
import { Globe, Clock, User, Monitor } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Visitor {
  id: string
  name: string | null
  email: string | null
  ip_address: string | null
  user_agent: string | null
  page_url: string | null
  last_seen_at: string
  created_at: string
}

export default function VisitorsPage() {
  const { data: visitors, mutate } = useApiCollection<Visitor>('/api/visitors')

  // Auto-refresh via dashboard SSE
  useSSE({
    url: '/api/events',
    events: {
      new_session: () => mutate(),
    },
  })

  function parseBrowser(ua: string | null): string {
    if (!ua) return 'Unknown'
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    return 'Other'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Live Visitors</h1>
          <p className="text-sm text-[var(--theme-text-muted)]">{visitors.length} visitor{visitors.length !== 1 ? 's' : ''} on site</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--theme-success)] animate-pulse" />
          <span className="text-xs text-[var(--theme-text-muted)]">Live</span>
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="text-center py-16 text-[var(--theme-text-muted)]">
          <User size={48} className="mx-auto mb-4 opacity-30" />
          <p>No visitors currently on site</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visitors.map(v => (
            <div key={v.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
              <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)]/10 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-[var(--theme-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{v.name || v.email || 'Anonymous'}</div>
                {v.page_url && (
                  <div className="flex items-center gap-1 text-xs text-[var(--theme-text-muted)] truncate">
                    <Globe size={12} />
                    <span className="truncate">{v.page_url}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--theme-text-muted)] flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Monitor size={12} />
                  {parseBrowser(v.user_agent)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(v.last_seen_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
