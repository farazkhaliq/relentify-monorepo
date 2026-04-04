'use client'

import { useState } from 'react'
import { apiCreate, apiUpdate } from '@/hooks/use-api'
import { X } from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  body: string
  category: string
  published: boolean
  language: string
  sort_order: number
}

interface ArticleEditorProps {
  article: Article | null
  onSaved: () => void
  onClose: () => void
}

export default function ArticleEditor({ article, onSaved, onClose }: ArticleEditorProps) {
  const [title, setTitle] = useState(article?.title || '')
  const [body, setBody] = useState(article?.body || '')
  const [category, setCategory] = useState(article?.category || 'General')
  const [published, setPublished] = useState(article?.published || false)
  const [language, setLanguage] = useState(article?.language || 'en')
  const [sortOrder, setSortOrder] = useState(article?.sort_order || 0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    try {
      const data = { title, body, category, published, language, sort_order: sortOrder }
      if (article) {
        await apiUpdate(`/api/knowledge/${article.id}`, data)
      } else {
        await apiCreate('/api/knowledge', data)
      }
      onSaved()
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--theme-border)] rounded-xl bg-[var(--theme-card)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{article ? 'Edit Article' : 'New Article'}</h2>
        <button onClick={onClose} className="p-1 hover:bg-[var(--theme-border)] rounded"><X size={16} /></button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)]"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] font-mono"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Language</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none"
              placeholder="en"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-background)] px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="published" className="text-sm">Published</label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !body.trim()}
            className="px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90"
          >
            {saving ? 'Saving...' : (article ? 'Update' : 'Create')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--theme-border)] rounded-lg text-sm hover:bg-[var(--theme-card)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
