'use client'
import { useEffect, useState } from 'react'
import { Toaster, toast } from '@relentify/ui'

interface LogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, string | number> | null
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'invoice.sent':    { label: 'Invoice sent',    color: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20' },
  'invoice.paid':   { label: 'Invoice paid',    color: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20' },
  'bill.created':   { label: 'Bill created',    color: 'text-[var(--theme-text-muted)] bg-[var(--theme-card)] border-[var(--theme-border)]' },
  'bill.paid':      { label: 'Bill paid',       color: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20' },
  'bill.deleted':   { label: 'Bill deleted',    color: 'text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 border-[var(--theme-destructive)]/20' },
  'settings.updated': { label: 'Settings updated', color: 'text-[var(--theme-warning)] bg-[var(--theme-warning)]/10 border-[var(--theme-warning)]/20' },
  'accountant.invited': { label: 'Accountant invited', color: 'text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/20' },
  'accountant.revoked': { label: 'Accountant revoked', color: 'text-[var(--theme-destructive)] bg-[var(--theme-destructive)]/10 border-[var(--theme-destructive)]/20' },
}

function metaSummary(entry: LogEntry): string {
  const m = entry.metadata
  if (!m) return ''
  if (entry.action === 'invoice.sent') return `${m.invoice_number} · ${m.client} · £${Number(m.total).toFixed(2)}`
  if (entry.action === 'bill.created' || entry.action === 'bill.paid') return `${m.supplier} · £${Number(m.amount).toFixed(2)}`
  if (entry.action === 'accountant.invited') return `${m.email}`
  return Object.values(m).join(' · ')
}

export default function AuditPage() {
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/audit')
      .then(r => r.json())
      .then(d => { if (d.log) setLog(d.log) })
      .catch(() => toast('Failed to load audit log', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const entityTypes = ['all', ...Array.from(new Set(log.map(e => e.entity_type)))]
  const filtered = filter === 'all' ? log : log.filter(e => e.entity_type === filter)

  return (
    <div className="min-h-screen bg-[var(--theme-background)] bg-transparent">
      <Toaster />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--theme-text)] tracking-tight">Audit Log</h2>
            <p className="text-[var(--theme-text-muted)] text-sm mt-1">Full history of actions in your account</p>
          </div>
          <div className="flex gap-2">
            {entityTypes.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors cursor-pointer ${filter === t ? 'bg-[var(--theme-accent)] text-[var(--theme-text)] border-[var(--theme-accent)]' : 'bg-[var(--theme-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/20'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-[var(--theme-accent)]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] p-16 text-center">
            <p className="text-[var(--theme-text-muted)] text-sm">No activity recorded yet. Actions like sending invoices and creating bills will appear here.</p>
          </div>
        ) : (
          <div className="bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-[2rem] overflow-hidden">
            <div className="divide-y divide-[var(--theme-border)]">
              {filtered.map(entry => {
                const style = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-[var(--theme-text-muted)] bg-[var(--theme-card)] border-[var(--theme-border)]' }
                const summary = metaSummary(entry)
                const dt = new Date(entry.created_at)
                return (
                  <div key={entry.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="shrink-0 text-right text-xs text-[var(--theme-text-muted)] w-28">
                      <div>{dt.toLocaleDateString('en-GB')}</div>
                      <div className="text-[10px]">{dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${style.color}`}>
                      {style.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      {summary && <p className="text-sm text-[var(--theme-text)] truncate">{summary}</p>}
                      {entry.entity_id && <p className="text-[10px] text-[var(--theme-text-muted)] font-mono truncate">{entry.entity_id}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
