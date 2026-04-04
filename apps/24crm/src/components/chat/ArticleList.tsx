'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { apiDelete } from '@/hooks/use-api'

interface Article {
  id: string
  title: string
  slug: string
  category: string
  published: boolean
  language: string
  sort_order: number
  updated_at: string
}

interface ArticleListProps {
  articles: Article[]
  onEdit: (article: Article) => void
  onRefresh: () => void
}

export default function ArticleList({ articles, onEdit, onRefresh }: ArticleListProps) {
  async function handleDelete(id: string) {
    if (!confirm('Delete this article?')) return
    await apiDelete(`/api/knowledge/${id}`)
    onRefresh()
  }

  return (
    <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--theme-card)] border-b border-[var(--theme-border)]">
            <th className="text-left px-4 py-2.5 font-medium">Title</th>
            <th className="text-left px-4 py-2.5 font-medium">Category</th>
            <th className="text-left px-4 py-2.5 font-medium">Status</th>
            <th className="text-left px-4 py-2.5 font-medium">Order</th>
            <th className="text-right px-4 py-2.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {articles.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-[var(--theme-text-muted)]">No articles yet</td>
            </tr>
          )}
          {articles.map(a => (
            <tr key={a.id} className="border-b border-[var(--theme-border)] hover:bg-[var(--theme-card)]">
              <td className="px-4 py-2.5 font-medium">{a.title}</td>
              <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{a.category}</td>
              <td className="px-4 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.published
                    ? 'bg-[var(--theme-success)]/10 text-[var(--theme-success)]'
                    : 'bg-[var(--theme-text-muted)]/10 text-[var(--theme-text-muted)]'
                }`}>
                  {a.published ? 'Published' : 'Draft'}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[var(--theme-text-muted)]">{a.sort_order}</td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(a as any)} className="p-1.5 hover:bg-[var(--theme-border)] rounded" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-[var(--theme-destructive)]/10 text-[var(--theme-destructive)] rounded" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
