'use client'

import { use, useState } from 'react'
import { useApiDoc, apiUpdate } from '@/hooks/use-api'
import { ArrowLeft, Play, Save } from 'lucide-react'
import Link from 'next/link'

export default function BotBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: bot, mutate } = useApiDoc<any>(`/api/bots/${id}`)
  const [flow, setFlow] = useState<string>('')
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  if (!bot) return <div className="p-4 text-[var(--theme-text-muted)]">Loading...</div>

  // Initialize flow editor with current JSON
  if (!flow && bot.flow) {
    setFlow(JSON.stringify(bot.flow, null, 2))
  }

  async function handleSave() {
    try {
      setSaving(true)
      const parsed = JSON.parse(flow)
      await apiUpdate(`/api/bots/${id}`, { flow: parsed })
      mutate()
    } catch (err) {
      alert('Invalid JSON')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    const inputs = testInput.split('\n').filter(Boolean)
    const res = await fetch(`/api/bots/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: inputs }),
    })
    setTestResult(await res.json())
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/bots" className="flex items-center gap-1 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] mb-2">
          <ArrowLeft size={14} /> Back to bots
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{bot.name}</h1>
          <div className="flex gap-2">
            <button onClick={handleTest} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
              <Play size={14} /> Test
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--theme-primary)] text-white disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Flow (JSON)</label>
          <textarea value={flow} onChange={(e) => setFlow(e.target.value)} rows={20}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-xs font-mono outline-none" />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Test Input (one per line)</label>
          <textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={4}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none mb-3"
            placeholder="Pricing&#10;test@example.com" />

          {testResult && (
            <div className="border border-[var(--theme-border)] rounded-xl p-4">
              <h3 className="text-sm font-bold mb-2">Test Result</h3>
              <div className="space-y-1 text-xs font-mono">
                {testResult.messages?.map((m: string, i: number) => (
                  <div key={i} className={m.startsWith('[user]') ? 'text-[var(--theme-primary)]' : 'text-[var(--theme-text-muted)]'}>{m}</div>
                ))}
              </div>
              {Object.keys(testResult.context || {}).length > 0 && (
                <div className="mt-3 text-xs">
                  <strong>Context:</strong> {JSON.stringify(testResult.context)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
