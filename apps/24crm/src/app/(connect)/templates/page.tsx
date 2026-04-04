'use client'

import { Plus, FileText } from 'lucide-react'
import { useApiCollection, apiCreate, apiDelete } from '@/hooks/use-api'

export default function TemplatesPage() {
  const { data: templates, mutate } = useApiCollection<any>('/api/templates')

  async function handleCreate() {
    const name = prompt('Template name:')
    if (!name?.trim()) return
    const channel = prompt('Channel (whatsapp/email/sms):') || 'email'
    const body = prompt('Template body:') || ''
    await apiCreate('/api/templates', { name, channel, body })
    mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-[var(--theme-primary)]" />
          <h1 className="text-2xl font-bold">Templates</h1>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> New Template
        </button>
      </div>

      <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--theme-card)] border-b border-[var(--theme-border)]">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Channel</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-[var(--theme-text-muted)]">No templates</td></tr>}
            {templates.map((t: any) => (
              <tr key={t.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
                <td className="px-4 py-2.5 font-medium">{t.name}</td>
                <td className="px-4 py-2.5 capitalize">{t.channel}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.approved ? 'bg-[var(--theme-success)]/10 text-[var(--theme-success)]' : 'bg-[var(--theme-text-muted)]/10 text-[var(--theme-text-muted)]'}`}>
                    {t.approved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={async () => { await apiDelete(`/api/templates/${t.id}`); mutate() }} className="text-xs text-[var(--theme-destructive)]">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
