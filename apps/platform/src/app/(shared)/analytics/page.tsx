'use client'

import { useState, useMemo } from 'react'
import { BarChart3, Clock, Star, CheckCircle, MessageSquare, Bot, Ticket, Phone } from 'lucide-react'
import { useApiDoc } from '@/hooks/use-api'

function useProduct() {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (host.includes('chat.')) return 'chat'
  if (host.includes('connect.')) return 'connect'
  return 'crm'
}

export default function AnalyticsPage() {
  const product = useProduct()
  const [days, setDays] = useState(30)
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString() }, [days])
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
            <button key={d} onClick={() => setDays(d)} className={`text-xs px-3 py-1.5 rounded-full ${days === d ? 'bg-[var(--theme-primary)] text-white' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)]'}`}>{d}d</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-[var(--theme-text-muted)]">Loading analytics...</div>
      ) : data ? (
        <>
          {/* KPI row — different per product */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {product === 'chat' ? (
              <>
                <KPI icon={MessageSquare} label="Sessions" value={data.session_count} />
                <KPI icon={Clock} label="Avg Response" value={formatSeconds(data.avg_first_response_seconds)} />
                <KPI icon={CheckCircle} label="Resolution Rate" value={`${data.resolution_rate}%`} />
                <KPI icon={Star} label="CSAT" value={data.csat_average ? `${data.csat_average}/5` : 'N/A'} />
              </>
            ) : (
              <>
                <KPI icon={Bot} label="Bot Resolution" value={`${data.bot_resolution_rate ?? 0}%`} />
                <KPI icon={Phone} label="Total Calls" value={data.voice?.total_calls ?? 0} />
                <KPI icon={Clock} label="Avg Call Wait" value={`${Math.round(data.voice?.avg_wait_seconds ?? 0)}s`} />
                <KPI icon={CheckCircle} label="Missed Calls" value={data.voice?.missed_calls ?? 0} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chat-specific panels */}
            {product === 'chat' && (
              <>
                <Panel title="Message Breakdown">
                  {data.message_breakdown?.map((m: any) => (
                    <Row key={m.sender_type} label={m.sender_type} value={m.count} />
                  ))}
                </Panel>
                {data.ai_usage && (
                  <Panel title="AI Usage" icon={Bot}>
                    <Row label="AI Replies" value={data.ai_usage.ai_replies} />
                    <Row label="Tokens In" value={data.ai_usage.ai_tokens_in?.toLocaleString()} />
                    <Row label="Tokens Out" value={data.ai_usage.ai_tokens_out?.toLocaleString()} />
                  </Panel>
                )}
                <Panel title="Tickets" icon={Ticket}>
                  <Row label="Total" value={data.ticket_stats?.total} />
                  <Row label="Open" value={data.ticket_stats?.open} />
                  <Row label="Resolved" value={data.ticket_stats?.resolved} />
                </Panel>
              </>
            )}

            {/* Connect/CRM panels */}
            {product !== 'chat' && (
              <>
                <Panel title="Conversations by Channel">
                  {data.conversations_per_channel?.map((c: any) => (
                    <Row key={c.channel} label={c.channel} value={c.count} />
                  ))}
                </Panel>
                <Panel title="Response Time by Channel">
                  {data.response_time_by_channel?.map((c: any) => (
                    <Row key={c.channel} label={c.channel} value={`${Math.round(c.avg_seconds)}s`} />
                  ))}
                </Panel>
                <Panel title="Resolution Rate by Channel">
                  {data.resolution_rate_by_channel?.map((c: any) => (
                    <Row key={c.channel} label={c.channel} value={`${c.rate}%`} />
                  ))}
                </Panel>
              </>
            )}

            {/* Shared: Agent Leaderboard */}
            <Panel title="Agent Leaderboard">
              {data.agent_leaderboard?.length === 0 && <p className="text-sm text-[var(--theme-text-muted)]">No activity</p>}
              {data.agent_leaderboard?.map((a: any) => (
                <Row key={a.agent_id} label={a.full_name} value={product === 'chat' ? `${a.sessions} sessions, ${a.messages} msgs` : `${a.conversations} convs`} />
              ))}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KPI({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="border border-[var(--theme-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2"><Icon size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs text-[var(--theme-text-muted)]">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--theme-border)] rounded-xl p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">{Icon && <Icon size={14} />}{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
      <span className="capitalize">{label}</span><span className="font-medium">{value}</span>
    </div>
  )
}
