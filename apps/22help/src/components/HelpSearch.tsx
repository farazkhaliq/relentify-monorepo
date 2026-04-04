'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@relentify/ui'

interface PagefindResult {
  id: string
  data: () => Promise<{
    url: string
    meta: { title: string }
    excerpt: string
  }>
}

declare global {
  interface Window {
    pagefind?: {
      search: (query: string) => Promise<{ results: PagefindResult[] }>
    }
  }
}

export function HelpSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ url: string; title: string; excerpt: string }>>([])
  const [loaded, setLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = '/_pagefind/pagefind.js'
    script.type = 'module'
    script.onload = () => setLoaded(true)
    script.onerror = () => { /* dev mode — pagefind not built yet */ }
    document.head.appendChild(script)
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (!loaded || !query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const pf = window.pagefind
      if (!pf) return
      const { results } = await pf.search(query)
      const resolved = await Promise.all(results.slice(0, 8).map(r => r.data()))
      setResults(resolved.map(r => ({
        url: r.url,
        title: r.meta.title,
        excerpt: r.excerpt,
      })))
    }, 200)
  }, [query, loaded])

  return (
    <div className="relative w-full">
      <Input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
        className="w-full"
      />
      {results.length > 0 && (
        <ul className="absolute top-full mt-2 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-lg z-50 overflow-hidden divide-y divide-[var(--theme-border)]">
          {results.map(r => (
            <li key={r.url}>
              <a
                href={r.url}
                className="block px-4 py-3 hover:bg-[var(--theme-background)] transition-colors"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <p
                  className="text-xs text-[var(--theme-text-muted)] mt-0.5 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
