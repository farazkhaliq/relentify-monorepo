'use client'

import { useState } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import { useApiCollection } from '@/hooks/use-api'
import ArticleList from '@/components/knowledge/ArticleList'
import ArticleEditor from '@/components/knowledge/ArticleEditor'

interface Article {
  id: string
  title: string
  slug: string
  body: string
  category: string
  published: boolean
  language: string
  sort_order: number
  updated_at: string
}

export default function KnowledgePage() {
  const { data: articles, mutate } = useApiCollection<Article>('/api/knowledge')
  const [editing, setEditing] = useState<Article | null | 'new'>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-[var(--theme-primary)]" />
          <div>
            <h1 className="text-2xl font-bold">Knowledge Base</h1>
            <p className="text-sm text-[var(--theme-text-muted)]">{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> New Article
        </button>
      </div>

      {editing && (
        <div className="mb-6">
          <ArticleEditor
            article={editing === 'new' ? null : editing}
            onSaved={() => { setEditing(null); mutate() }}
            onClose={() => setEditing(null)}
          />
        </div>
      )}

      <ArticleList
        articles={articles}
        onEdit={(a) => setEditing(a as any)}
        onRefresh={() => mutate()}
      />
    </div>
  )
}
