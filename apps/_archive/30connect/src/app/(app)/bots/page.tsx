'use client'

import { Plus, Bot } from 'lucide-react'
import { useApiCollection, apiCreate, apiDelete } from '@/hooks/use-api'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function BotsPage() {
  const { data: bots, mutate } = useApiCollection<any>('/api/bots')

  async function handleCreate() {
    const name = prompt('Bot name:')
    if (!name?.trim()) return
    await apiCreate('/api/bots', { name, flow: { nodes: [{ id: 'start', type: 'message', text: 'Hello! How can I help?', next: null }] } })
    mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot size={24} className="text-[var(--theme-primary)]" />
          <h1 className="text-2xl font-bold">Chatbots</h1>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New Bot
        </button>
      </div>

      <div className="grid gap-3">
        {bots.length === 0 && (
          <div className="text-center py-12 text-[var(--theme-text-muted)]">
            <Bot size={36} className="mx-auto mb-3 opacity-30" />
            <p>No chatbots yet. Create one to automate conversations.</p>
          </div>
        )}
        {bots.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between p-4 border border-[var(--theme-border)] rounded-xl hover:bg-[var(--theme-card)]">
            <div>
              <Link href={`/bots/${b.id}`} className="font-medium text-sm hover:underline">{b.name}</Link>
              {b.description && <p className="text-xs text-[var(--theme-text-muted)]">{b.description}</p>}
              <span className={`text-xs ${b.enabled ? 'text-[var(--theme-success)]' : 'text-[var(--theme-text-muted)]'}`}>
                {b.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--theme-text-dim)]">{formatDistanceToNow(new Date(b.updated_at), { addSuffix: true })}</span>
              <button onClick={async () => { await apiDelete(`/api/bots/${b.id}`); mutate() }} className="text-xs text-[var(--theme-destructive)]">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
