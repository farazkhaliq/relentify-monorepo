'use client'

import { ClipboardCheck } from 'lucide-react'
import { useApiCollection } from '@/hooks/use-api'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function QualityPage() {
  const { data: reviews } = useApiCollection<any>('/api/quality')

  const avgScores = reviews.length > 0 ? {
    helpfulness: (reviews.reduce((s: number, r: any) => s + (r.scores?.helpfulness || 0), 0) / reviews.length).toFixed(1),
    accuracy: (reviews.reduce((s: number, r: any) => s + (r.scores?.accuracy || 0), 0) / reviews.length).toFixed(1),
    tone: (reviews.reduce((s: number, r: any) => s + (r.scores?.tone || 0), 0) / reviews.length).toFixed(1),
    resolution: (reviews.reduce((s: number, r: any) => s + (r.scores?.resolution || 0), 0) / reviews.length).toFixed(1),
  } : null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={24} className="text-[var(--theme-primary)]" />
        <h1 className="text-2xl font-bold">Quality Assurance</h1>
      </div>

      {avgScores && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(avgScores).map(([k, v]) => (
            <div key={k} className="border border-[var(--theme-border)] rounded-xl p-4 text-center">
              <div className="text-xs text-[var(--theme-text-muted)] capitalize">{k}</div>
              <div className="text-2xl font-bold">{v}/5</div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--theme-card)] border-b border-[var(--theme-border)]">
              <th className="text-left px-4 py-2.5 font-medium">Conversation</th>
              <th className="text-left px-4 py-2.5 font-medium">Scores</th>
              <th className="text-left px-4 py-2.5 font-medium">AI Score</th>
              <th className="text-left px-4 py-2.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-[var(--theme-text-muted)]">No reviews yet</td></tr>}
            {reviews.map((r: any) => (
              <tr key={r.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
                <td className="px-4 py-2.5 font-mono text-xs">{r.conversation_id.slice(0, 8)}...</td>
                <td className="px-4 py-2.5 text-xs">
                  H:{r.scores?.helpfulness} A:{r.scores?.accuracy} T:{r.scores?.tone} R:{r.scores?.resolution}
                </td>
                <td className="px-4 py-2.5 text-xs">{r.ai_score ? `Overall: ${r.ai_score.overall}/5` : '-'}</td>
                <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
