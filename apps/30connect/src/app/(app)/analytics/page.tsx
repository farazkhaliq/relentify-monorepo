'use client'

import { useState, useMemo } from 'react'
import { BarChart3, Phone, Bot, Clock, CheckCircle } from 'lucide-react'
import { useApiDoc } from '@/hooks/use-api'

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString() }, [days])
  const { data, isLoading } = useApiDoc<any>(`/api/analytics?from=${from}`)

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

      {isLoading ? <div className="text-center py-12 text-[var(--theme-text-muted)]">Loading...</div> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI icon={Bot} label="Bot Resolution" value={`${data.bot_resolution_rate}%`} />
            <KPI icon={Phone} label="Total Calls" value={data.voice.total_calls} />
            <KPI icon={Clock} label="Avg Call Wait" value={`${Math.round(data.voice.avg_wait_seconds)}s`} />
            <KPI icon={CheckCircle} label="Missed Calls" value={data.voice.missed_calls} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Conversations by Channel</h3>
              {data.conversations_per_channel?.map((c: any) => (
                <div key={c.channel} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span className="capitalize">{c.channel}</span><span className="font-medium">{c.count}</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Response Time by Channel</h3>
              {data.response_time_by_channel?.map((c: any) => (
                <div key={c.channel} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span className="capitalize">{c.channel}</span><span className="font-medium">{Math.round(c.avg_seconds)}s</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Resolution Rate by Channel</h3>
              {data.resolution_rate_by_channel?.map((c: any) => (
                <div key={c.channel} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span className="capitalize">{c.channel}</span><span className="font-medium">{c.rate}%</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-3">Agent Leaderboard</h3>
              {data.agent_leaderboard?.length === 0 && <p className="text-sm text-[var(--theme-text-muted)]">No activity</p>}
              {data.agent_leaderboard?.map((a: any) => (
                <div key={a.agent_id} className="flex justify-between text-sm py-1.5 border-b border-[var(--theme-border)] last:border-0">
                  <span>{a.full_name}</span><span className="text-[var(--theme-text-muted)]">{a.conversations} convs</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KPI({ icon: Icon, label, value }: any) {
  return (
    <div className="border border-[var(--theme-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2"><Icon size={14} className="text-[var(--theme-text-muted)]" /><span className="text-xs text-[var(--theme-text-muted)]">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
