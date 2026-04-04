'use client'

import { useState, useMemo } from 'react'
import { BarChart3, Clock, Star, CheckCircle, MessageSquare, Bot, Ticket } from 'lucide-react'
import { useApiDoc } from '@/hooks/use-api'

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const from = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString()
  }, [days])

  const { data, isLoading } = useApiDoc<any>(`/api/analytics?from=${from}`)

  function formatSeconds(s: number | null): string {
    if (!s) return 'N/A'
    if (s < 60) return `${Math.round(s)}s`
    return `${Math.round(s / 60)}m`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-[var(--theme-primary)]" />
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`text-xs px-3 py-1.5 rounded-full ${days === d ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-[var(--theme-text-muted)]">Loading analytics...</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard icon={MessageSquare} label="Sessions" value={data.session_count} />
            <KPICard icon={Clock} label="Avg Response" value={formatSeconds(data.avg_first_response_seconds)} />
            <KPICard icon={CheckCircle} label="Resolution Rate" value={`${data.resolution_rate}%`} />
            <KPICard icon={Star} label="CSAT" value={data.csat_average ? `${data.csat_average}/5` : 'N/A'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Message Breakdown */}
            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Message Breakdown</h3>
              {data.message_breakdown?.map((m: any) => (
                <div key={m.sender_type} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span className="capitalize">{m.sender_type}</span>
                  <span className="font-medium">{m.count}</span>
                </div>
              ))}
            </div>

            {/* Agent Leaderboard */}
            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Agent Leaderboard</h3>
              {data.agent_leaderboard?.length === 0 && <p className="text-sm text-[var(--theme-text-muted)]">No agent activity</p>}
              {data.agent_leaderboard?.map((a: any) => (
                <div key={a.agent_id} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span>{a.full_name}</span>
                  <span className="text-[var(--theme-text-muted)]">{a.sessions} sessions, {a.messages} msgs</span>
                </div>
              ))}
            </div>

            {/* AI Usage */}
            {data.ai_usage && (
              <div className="border border-[var(--theme-border)] rounded-xl p-4">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Bot size={14} /> AI Usage</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>AI Replies</span><span className="font-medium">{data.ai_usage.ai_replies}</span></div>
                  <div className="flex justify-between"><span>Tokens In</span><span className="font-medium">{data.ai_usage.ai_tokens_in.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Tokens Out</span><span className="font-medium">{data.ai_usage.ai_tokens_out.toLocaleString()}</span></div>
                </div>
              </div>
            )}

            {/* Ticket Stats */}
            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Ticket size={14} /> Tickets</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Total</span><span className="font-medium">{data.ticket_stats.total}</span></div>
                <div className="flex justify-between"><span>Open</span><span className="font-medium">{data.ticket_stats.open}</span></div>
                <div className="flex justify-between"><span>Resolved</span><span className="font-medium">{data.ticket_stats.resolved}</span></div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KPICard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="border border-[var(--theme-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-[var(--theme-text-muted)]" />
        <span className="text-xs text-[var(--theme-text-muted)]">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
