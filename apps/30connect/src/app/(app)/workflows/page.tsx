'use client'

import { Plus, Workflow } from 'lucide-react'
import { useApiCollection, apiCreate, apiDelete } from '@/hooks/use-api'
import Link from 'next/link'

export default function WorkflowsPage() {
  const { data: workflows, mutate } = useApiCollection<any>('/api/workflows')

  async function handleCreate() {
    const name = prompt('Workflow name:')
    if (!name?.trim()) return
    await apiCreate('/api/workflows', { name, trigger_event: 'conversation.created', conditions: [], actions: [] })
    mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Workflow size={24} className="text-[var(--theme-primary)]" />
          <h1 className="text-2xl font-bold">Workflows</h1>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> New Workflow
        </button>
      </div>

      <div className="grid gap-3">
        {workflows.length === 0 && (
          <div className="text-center py-12 text-[var(--theme-text-muted)]">
            <Workflow size={36} className="mx-auto mb-3 opacity-30" />
            <p>No workflows yet. Create one to automate conversation handling.</p>
          </div>
        )}
        {workflows.map((wf: any) => (
          <div key={wf.id} className="flex items-center justify-between p-4 border border-[var(--theme-border)] rounded-xl hover:bg-[var(--theme-card)]">
            <div>
              <Link href={`/workflows/${wf.id}`} className="font-medium text-sm hover:underline">{wf.name}</Link>
              <div className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                Trigger: <span className="font-mono">{wf.trigger_event}</span>
                {' · '}{(wf.conditions || []).length} conditions · {(wf.actions || []).length} actions
              </div>
              <span className={`text-xs ${wf.enabled ? 'text-[var(--theme-success)]' : 'text-[var(--theme-text-muted)]'}`}>
                {wf.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button onClick={async () => { await apiDelete(`/api/workflows/${wf.id}`); mutate() }} className="text-xs text-[var(--theme-destructive)]">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
