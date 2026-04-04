'use client'

import { useApiDoc } from '@/hooks/use-api'
import { User, Mail, Phone, Globe } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import pool from '@/lib/pool'

export default function ContactsPage() {
  const { data } = useApiDoc<{ conversations: any[] }>('/api/conversations?limit=100')
  const conversations = data?.conversations || []

  // Deduplicate contacts by email or phone
  const contactMap = new Map<string, any>()
  for (const c of conversations) {
    const key = c.contact_email || c.contact_phone || c.external_id || c.id
    if (!contactMap.has(key)) {
      contactMap.set(key, { ...c, conversations: 1 })
    } else {
      contactMap.get(key)!.conversations++
    }
  }
  const contacts = Array.from(contactMap.values())

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <User size={24} className="text-[var(--theme-primary)]" />
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-[var(--theme-text-muted)]">{contacts.length} contacts</p>
        </div>
      </div>

      <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--theme-card)] border-b border-[var(--theme-border)]">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Phone</th>
              <th className="text-left px-4 py-2.5 font-medium">Channel</th>
              <th className="text-left px-4 py-2.5 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-[var(--theme-text-muted)]">No contacts yet</td></tr>
            )}
            {contacts.map((c: any) => (
              <tr key={c.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
                <td className="px-4 py-2.5 font-medium">{c.contact_name || 'Unknown'}</td>
                <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{c.contact_email || '-'}</td>
                <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{c.contact_phone || '-'}</td>
                <td className="px-4 py-2.5 capitalize">{c.channel}</td>
                <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
