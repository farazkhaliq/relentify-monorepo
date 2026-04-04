'use client'

import { use, useState } from 'react'
import { useApiDoc, apiUpdate } from '@/hooks/use-api'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const TRIGGER_EVENTS = [
  'conversation.created', 'conversation.assigned', 'conversation.resolved',
  'message.created', 'contact.identified', 'tag.added', 'sla.breached',
]

const ACTION_TYPES = [
  'assign_agent', 'assign_department', 'send_message', 'add_tag',
  'set_priority', 'set_status', 'send_webhook', 'send_email_notification',
]

export default function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: wf, mutate } = useApiDoc<any>(`/api/workflows/${id}`)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [conditionsJson, setConditionsJson] = useState('')
  const [actionsJson, setActionsJson] = useState('')

  if (!wf) return <div className="p-4 text-[var(--theme-text-muted)]">Loading...</div>

  if (!name && wf.name) {
    setName(wf.name)
    setTrigger(wf.trigger_event)
    setEnabled(wf.enabled)
    setConditionsJson(JSON.stringify(wf.conditions || [], null, 2))
    setActionsJson(JSON.stringify(wf.actions || [], null, 2))
  }

  async function handleSave() {
    try {
      setSaving(true)
      await apiUpdate(`/api/workflows/${id}`, {
        name, trigger_event: trigger, enabled,
        conditions: JSON.parse(conditionsJson),
        actions: JSON.parse(actionsJson),
      })
      mutate()
    } catch { alert('Invalid JSON') } finally { setSaving(false) }
  }

  return (
    <div>
      <Link href="/workflows" className="flex items-center gap-1 text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] mb-4">
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="flex items-center justify-between mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} className="text-xl font-bold bg-transparent outline-none border-b border-transparent focus:border-[var(--theme-primary)]" />
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Trigger Event</label>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm">
              {TRIGGER_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
            </label>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Conditions (JSON)</label>
            <textarea value={conditionsJson} onChange={(e) => setConditionsJson(e.target.value)} rows={8}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-xs font-mono outline-none" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Actions (JSON)</label>
          <textarea value={actionsJson} onChange={(e) => setActionsJson(e.target.value)} rows={16}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-xs font-mono outline-none" />
          <p className="text-xs text-[var(--theme-text-dim)] mt-2">Action types: {ACTION_TYPES.join(', ')}</p>
        </div>
      </div>
    </div>
  )
}
