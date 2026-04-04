'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Badge, Button, Input } from '@relentify/ui'
import { MessageCircle, ChevronDown } from 'lucide-react'

interface FeedEvent {
  id: string; event_type: string; created_at: string; worker_name: string
  entry_id: string | null; trust_score: number | null; total_worked_minutes: number | null
  auto_clocked_out: boolean | null; is_within_geofence_in: boolean | null; site_name: string | null
  comment_count: number; clock_in_at: string | null; clock_out_at: string | null
}

interface Comment { id: string; author_name: string; body: string; created_at: string }

const EVENT_LABELS: Record<string, string> = {
  clock_in: 'clocked in', clock_out: 'clocked out', break_start: 'started break',
  break_end: 'ended break', status_change: 'status changed', auto_clock_out: 'auto clocked out',
  shift_assigned: 'shift assigned', shift_cancelled: 'shift cancelled',
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')

  const fetchFeed = useCallback(async (p: number) => {
    const res = await fetch(`/api/feed?page=${p}&limit=20`)
    const data = await res.json()
    if (p === 1) setEvents(data.events || [])
    else setEvents(prev => [...prev, ...(data.events || [])])
    setHasMore(data.hasMore)
  }, [])

  useEffect(() => { fetchFeed(1) }, [fetchFeed])

  const handleExpand = async (event: FeedEvent) => {
    if (expanded === event.id) { setExpanded(null); return }
    setExpanded(event.id)
    if (event.entry_id) {
      const res = await fetch(`/api/comments?entryId=${event.entry_id}&feedEventType=${event.event_type}`)
      const data = await res.json()
      setComments(data.comments || [])
    }
  }

  const handleComment = async (event: FeedEvent) => {
    if (!newComment.trim() || !event.entry_id) return
    await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: event.entry_id, feedEventType: event.event_type, body: newComment }),
    })
    setNewComment('')
    const res = await fetch(`/api/comments?entryId=${event.entry_id}&feedEventType=${event.event_type}`)
    const data = await res.json()
    setComments(data.comments || [])
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Activity Feed</h1>

      <div className="grid gap-2">
        {events.map(e => {
          const trustColor = e.trust_score != null ? (e.trust_score >= 80 ? 'border-l-green-500' : e.trust_score >= 50 ? 'border-l-amber-500' : 'border-l-red-500') : ''
          return (
            <div key={e.id}>
              <Card className={`p-3 border-l-4 ${trustColor} cursor-pointer`} onClick={() => handleExpand(e)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-medium">{e.worker_name}</span>
                    <span className="text-[var(--theme-text-muted)]"> {EVENT_LABELS[e.event_type] || e.event_type}</span>
                    {e.site_name && <span className="text-[var(--theme-text-muted)]"> at {e.site_name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {e.comment_count > 0 && <Badge variant="outline" className="text-xs"><MessageCircle size={10} className="mr-1" />{e.comment_count}</Badge>}
                    <span className="text-xs text-[var(--theme-text-muted)]">{timeAgo(e.created_at)}</span>
                    <ChevronDown size={14} className={`transition-transform ${expanded === e.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </Card>
              {expanded === e.id && (
                <Card className="p-3 mt-1 ml-4 border-l-2 border-[var(--theme-border)]">
                  {e.trust_score != null && <p className="text-xs mb-2">Trust: {e.trust_score} | Worked: {Math.round((e.total_worked_minutes || 0) / 60 * 10) / 10}h</p>}
                  {comments.length > 0 && (
                    <div className="grid gap-1 mb-2">
                      {comments.map(c => (
                        <div key={c.id} className="text-xs p-1.5 bg-[var(--theme-muted)] rounded">
                          <span className="font-medium">{c.author_name}</span>: {c.body}
                          <span className="text-[var(--theme-text-muted)] ml-1">{timeAgo(c.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {e.entry_id && (
                    <div className="flex gap-2">
                      <Input placeholder="Add comment..." value={newComment} onChange={e => setNewComment(e.target.value)} className="text-sm h-8" onKeyDown={ev => ev.key === 'Enter' && handleComment(e)} />
                      <Button size="sm" onClick={() => handleComment(e)} disabled={!newComment.trim()}>Send</Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && <Button variant="outline" className="w-full mt-4" onClick={() => { setPage(p => p + 1); fetchFeed(page + 1) }}>Load More</Button>}
      {events.length === 0 && <p className="text-[var(--theme-text-muted)]">No activity yet. Events appear when workers clock in/out.</p>}
    </div>
  )
}
