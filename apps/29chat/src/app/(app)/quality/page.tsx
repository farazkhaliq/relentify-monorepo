'use client'

import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useApiCollection, apiCreate } from '@/hooks/use-api'

export default function QualityPage() {
  const { data: reviews, mutate } = useApiCollection<any>('/api/quality')
  const [sessionId, setSessionId] = useState('')
  const [scores, setScores] = useState({ helpfulness: 3, accuracy: 3, tone: 3 })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionId.trim()) return
    setSaving(true)
    await apiCreate('/api/quality', { session_id: sessionId, ...scores, notes })
    setSessionId('')
    setNotes('')
    setScores({ helpfulness: 3, accuracy: 3, tone: 3 })
    setSaving(false)
    mutate()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={24} className="text-[var(--theme-primary)]" />
        <h1 className="text-2xl font-bold">Quality Assurance</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[var(--theme-border)] rounded-xl p-5">
          <h2 className="text-sm font-bold mb-4">New Review</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1">Session ID</label>
              <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none" placeholder="Paste session ID" />
            </div>
            {(['helpfulness', 'accuracy', 'tone'] as const).map(k => (
              <div key={k}>
                <label className="text-xs font-medium block mb-1 capitalize">{k} (1-5)</label>
                <input type="range" min={1} max={5} value={scores[k]} onChange={(e) => setScores({...scores, [k]: parseInt(e.target.value)})} className="w-full" />
                <span className="text-xs text-[var(--theme-text-muted)]">{scores[k]}/5</span>
              </div>
            ))}
            <div>
              <label className="text-xs font-medium block mb-1">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none" />
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Submit Review'}
            </button>
          </form>
        </div>

        <div className="border border-[var(--theme-border)] rounded-xl p-5">
          <h2 className="text-sm font-bold mb-4">Recent Reviews ({reviews.length})</h2>
          {reviews.length === 0 && <p className="text-sm text-[var(--theme-text-muted)]">No reviews yet</p>}
          {reviews.map((r: any, i: number) => (
            <div key={i} className="py-2 border-b border-[var(--theme-border)] last:border-0">
              <div className="text-xs font-mono text-[var(--theme-text-muted)]">{r.session_id.slice(0, 8)}...</div>
              <div className="text-xs mt-1">
                H: {r.review.scores.helpfulness}/5 · A: {r.review.scores.accuracy}/5 · T: {r.review.scores.tone}/5
              </div>
              {r.review.notes && <div className="text-xs text-[var(--theme-text-muted)] mt-1">{r.review.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
