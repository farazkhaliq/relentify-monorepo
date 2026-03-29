# Help System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `help.relentify.com` as a Zod-validated MDX help site with Playwright-generated video guides, Pagefind search, and contextual in-app help integrated into 22accounting.

**Architecture:** New monorepo app `apps/26help` — Next.js static export (`output: 'export'`), MDX files as content source with Zod frontmatter validation, Pagefind CLI run post-build to index `out/`, served via `serve` in Docker. In-app integration adds `HelpButton` (contextual link to help article) and `HelpTooltip` (field-level tooltip from a central field descriptions map) to 22accounting. `helpUrlMap` is auto-generated from MDX `appRoute` frontmatter — no manual maintenance.

**Tech Stack:** Next.js 15, `gray-matter`, `next-mdx-remote/rsc`, Zod, Pagefind CLI, Playwright, ffmpeg (video compression), `@relentify/ui` for shared Tooltip component.

---

## File Map

| File | Purpose |
|------|---------|
| `apps/26help/package.json` | App dependencies |
| `apps/26help/tsconfig.json` | TypeScript config |
| `apps/26help/next.config.js` | Static export config |
| `apps/26help/Dockerfile` | Container build |
| `apps/26help/docker-compose.yml` | Compose config (port 3026) |
| `apps/26help/src/lib/content.ts` | Zod schema + MDX loader |
| `apps/26help/src/app/layout.tsx` | Help site root layout |
| `apps/26help/src/app/page.tsx` | Home: search + category cards |
| `apps/26help/src/app/[category]/page.tsx` | Category listing |
| `apps/26help/src/app/[category]/[article]/page.tsx` | Article page |
| `apps/26help/src/app/sitemap.ts` | Auto-generated sitemap.xml |
| `apps/26help/src/components/ArticleLayout.tsx` | Article wrapper (breadcrumb, ToC, video) |
| `apps/26help/src/components/CategoryCard.tsx` | Home page category card |
| `apps/26help/src/components/VideoGuide.tsx` | Lazy-loaded accessible video player |
| `apps/26help/src/components/HelpSearch.tsx` | Pagefind-powered search UI |
| `apps/26help/content/accounting/*.mdx` | 20 accounting articles |
| `apps/26help/content/fields.ts` | Field key → tooltip text (used by HelpTooltip) |
| `apps/26help/playwright/record.ts` | Recording runner (ffmpeg compression) |
| `apps/26help/playwright/validate.ts` | CI validator — fails if UI elements missing |
| `apps/26help/playwright/scripts/*.ts` | 20 recording scripts |
| `/opt/infra/caddy/Caddyfile` | Add `help.relentify.com` block |
| `apps/22accounting/app/components/HelpButton.tsx` | `?` button in top nav |
| `apps/22accounting/app/components/HelpTooltip.tsx` | `ⓘ` inline field tooltip |
| `apps/22accounting/app/lib/help-urls.ts` | `generateHelpMap` + exported `helpUrlMap` |

---

### Task 1: App scaffold — package.json, tsconfig, next.config.js

**Files:**
- Create: `apps/26help/package.json`
- Create: `apps/26help/tsconfig.json`
- Create: `apps/26help/next.config.js`
- Create: `apps/26help/.env.example`

- [ ] **Step 1: Create `apps/26help/package.json`**

```json
{
  "name": "26help",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3026",
    "build": "next build",
    "start": "serve out -p 3026",
    "lint": "next lint",
    "build:search": "next build && npx pagefind --site out --output-path out/_pagefind"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "next": "15.5.14",
    "next-mdx-remote": "^5.0.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "serve": "^14.2.4",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "@tailwindcss/postcss": "^4.2.1",
    "@types/node": "^22.19.15",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "autoprefixer": "^10.4.27",
    "pagefind": "^1.1.0",
    "postcss": "^8.5.8",
    "tailwindcss": "^4.2.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `apps/26help/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "playwright"]
}
```

- [ ] **Step 3: Create `apps/26help/next.config.js`**

```js
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

module.exports = nextConfig
```

- [ ] **Step 4: Create `apps/26help/.env.example`**

```
# Playwright recording credentials (22accounting test user)
PLAYWRIGHT_EMAIL=help@test.com
PLAYWRIGHT_PASSWORD=testpassword123
PLAYWRIGHT_BASE_URL=http://localhost:3022
```

- [ ] **Step 5: Create `apps/26help/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --help-bg: #fafafa;
  --help-text: #111827;
  --help-muted: #6b7280;
  --help-border: #e5e7eb;
  --help-accent: #2563eb;
  --help-card: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --help-bg: #0f172a;
    --help-text: #f1f5f9;
    --help-muted: #94a3b8;
    --help-border: #1e293b;
    --help-accent: #60a5fa;
    --help-card: #1e293b;
  }
}

body {
  background: var(--help-bg);
  color: var(--help-text);
}
```

- [ ] **Step 6: Create `apps/26help/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
}

export default config
```

- [ ] **Step 7: Create `apps/26help/postcss.config.js`**

```js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/26help/package.json apps/26help/tsconfig.json apps/26help/next.config.js apps/26help/.env.example apps/26help/src/app/globals.css apps/26help/tailwind.config.ts apps/26help/postcss.config.js
git commit -m "feat(26help): scaffold app config"
```

---

### Task 2: Content schema — Zod validation + MDX loader

**Files:**
- Create: `apps/26help/src/lib/content.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/26help/src/lib/content.test.ts
import { ArticleSchema, getAllArticles, getArticle } from './content'

describe('content.ts', () => {
  it('rejects missing title', () => {
    expect(() => ArticleSchema.parse({ description: 'x', category: 'accounting', order: 1 })).toThrow()
  })

  it('rejects missing description', () => {
    expect(() => ArticleSchema.parse({ title: 'x', category: 'accounting', order: 1 })).toThrow()
  })

  it('accepts valid frontmatter with optional fields absent', () => {
    const result = ArticleSchema.parse({ title: 'T', description: 'D', category: 'accounting', order: 1 })
    expect(result.relatedArticles).toEqual([])
    expect(result.video).toBeUndefined()
    expect(result.appRoute).toBeUndefined()
  })
})
```

Run: `cd apps/26help && npx jest src/lib/content.test.ts`
Expected: FAIL (content.ts doesn't exist yet)

- [ ] **Step 2: Create `apps/26help/src/lib/content.ts`**

```ts
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export const ArticleSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  order: z.number(),
  video: z.string().optional(),
  appRoute: z.string().optional(),
  relatedArticles: z.array(z.string()).default([]),
})

export type ArticleFrontmatter = z.infer<typeof ArticleSchema>

export interface Article {
  slug: string
  category: string
  frontmatter: ArticleFrontmatter
  content: string
}

/** Validate and parse a raw frontmatter object. Throws ZodError with details on failure. */
export function parseArticleFrontmatter(raw: unknown, filePath: string): ArticleFrontmatter {
  const result = ArticleSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid frontmatter in ${filePath}:\n${issues}`)
  }
  return result.data
}

export function getAllCategories(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs.readdirSync(CONTENT_DIR).filter(f =>
    fs.statSync(path.join(CONTENT_DIR, f)).isDirectory()
  )
}

export function getArticlesByCategory(category: string): Article[] {
  const categoryDir = path.join(CONTENT_DIR, category)
  if (!fs.existsSync(categoryDir)) return []

  return fs
    .readdirSync(categoryDir)
    .filter(f => f.endsWith('.mdx'))
    .map(file => {
      const slug = file.replace('.mdx', '')
      const filePath = path.join(categoryDir, file)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(raw)
      const frontmatter = parseArticleFrontmatter(data, filePath)
      return { slug, category, frontmatter, content }
    })
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order)
}

export function getAllArticles(): Article[] {
  return getAllCategories().flatMap(getArticlesByCategory)
}

export function getArticle(category: string, slug: string): Article | null {
  const filePath = path.join(CONTENT_DIR, category, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  const frontmatter = parseArticleFrontmatter(data, filePath)
  return { slug, category, frontmatter, content }
}

/** Auto-generate route → help URL mapping from articles with appRoute frontmatter.
 *  Used by 22accounting HelpButton to link to the correct article from any route. */
export function generateHelpMap(articles: Article[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { frontmatter, category, slug } of articles) {
    if (frontmatter.appRoute) {
      map[frontmatter.appRoute] = `/${category}/${slug}`
    }
  }
  return map
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd apps/26help && npx jest src/lib/content.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add apps/26help/src/lib/content.ts apps/26help/src/lib/content.test.ts
git commit -m "feat(26help): content schema with Zod validation"
```

---

### Task 3: Core pages — layout, home, category, article

**Files:**
- Create: `apps/26help/src/app/layout.tsx`
- Create: `apps/26help/src/app/page.tsx`
- Create: `apps/26help/src/app/[category]/page.tsx`
- Create: `apps/26help/src/app/[category]/[article]/page.tsx`

- [ ] **Step 1: Create `apps/26help/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s — Relentify Help', default: 'Relentify Help' },
  description: 'Guides and documentation for Relentify accounting software.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--help-bg)] text-[var(--help-text)]">
        <header className="border-b border-[var(--help-border)] bg-[var(--help-card)]">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="font-bold text-lg tracking-tight">
              Relentify Help
            </a>
            <a
              href="https://accounting.relentify.com"
              className="text-sm text-[var(--help-muted)] hover:text-[var(--help-text)] transition-colors"
            >
              Back to app →
            </a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-[var(--help-border)] mt-20">
          <div className="max-w-4xl mx-auto px-6 py-6 text-sm text-[var(--help-muted)]">
            © {new Date().getFullYear()} Relentify Ltd
          </div>
        </footer>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `apps/26help/src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { getAllCategories, getArticlesByCategory } from '@/lib/content'

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  accounting: {
    label: 'Accounting',
    description: 'Invoices, bills, expenses, bank reconciliation, and reports.',
    icon: '📊',
  },
  crm: {
    label: 'CRM',
    description: 'Customers, suppliers, contacts, and relationships.',
    icon: '👥',
  },
  reminders: {
    label: 'Reminders',
    description: 'Tasks, deadlines, and notifications.',
    icon: '🔔',
  },
  api: {
    label: 'Developer API',
    description: 'API reference, authentication, and webhooks.',
    icon: '⚙️',
  },
  migration: {
    label: 'Migration',
    description: 'Import data from spreadsheets and other accounting systems.',
    icon: '📥',
  },
}

export default function HomePage() {
  const categories = getAllCategories()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">How can we help?</h1>
      <p className="text-[var(--help-muted)] mb-8">
        Browse guides or search for what you need.
      </p>

      {/* Search placeholder — Pagefind hydrates this client-side */}
      <div id="help-search" className="mb-12" />

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map(category => {
          const meta = CATEGORY_META[category]
          const articles = getArticlesByCategory(category)
          if (!meta) return null
          return (
            <Link
              key={category}
              href={`/${category}`}
              className="block rounded-xl border border-[var(--help-border)] bg-[var(--help-card)] p-6 hover:border-[var(--help-accent)] transition-colors"
            >
              <div className="text-3xl mb-3">{meta.icon}</div>
              <h2 className="font-semibold text-lg mb-1">{meta.label}</h2>
              <p className="text-sm text-[var(--help-muted)] mb-2">{meta.description}</p>
              <p className="text-xs text-[var(--help-accent)]">{articles.length} articles</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/26help/src/app/[category]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllCategories, getArticlesByCategory } from '@/lib/content'
import type { Metadata } from 'next'

interface Props { params: Promise<{ category: string }> }

export async function generateStaticParams() {
  return getAllCategories().map(category => ({ category }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  return { title: category.charAt(0).toUpperCase() + category.slice(1) }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const articles = getArticlesByCategory(category)
  if (articles.length === 0) notFound()

  return (
    <div>
      <nav className="text-sm text-[var(--help-muted)] mb-6">
        <Link href="/" className="hover:text-[var(--help-text)]">Help</Link>
        <span className="mx-2">/</span>
        <span className="capitalize">{category}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>
      <div className="divide-y divide-[var(--help-border)]">
        {articles.map(article => (
          <Link
            key={article.slug}
            href={`/${category}/${article.slug}`}
            className="block py-4 hover:text-[var(--help-accent)] transition-colors"
          >
            <p className="font-medium">{article.frontmatter.title}</p>
            <p className="text-sm text-[var(--help-muted)] mt-1">{article.frontmatter.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `apps/26help/src/app/[category]/[article]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import Link from 'next/link'
import { getAllArticles, getArticle, getArticlesByCategory } from '@/lib/content'
import { VideoGuide } from '@/components/VideoGuide'
import type { Metadata } from 'next'

interface Props { params: Promise<{ category: string; article: string }> }

export async function generateStaticParams() {
  return getAllArticles().map(a => ({ category: a.category, article: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, article } = await params
  const data = getArticle(category, article)
  if (!data) return {}
  return {
    title: data.frontmatter.title,
    description: data.frontmatter.description,
    alternates: { canonical: `https://help.relentify.com/${category}/${article}` },
    openGraph: {
      title: `${data.frontmatter.title} — Relentify Help`,
      description: data.frontmatter.description,
    },
  }
}

const mdxComponents = {
  VideoGuide,
}

export default async function ArticlePage({ params }: Props) {
  const { category, article } = await params
  const data = getArticle(category, article)
  if (!data) notFound()

  const { frontmatter, content } = data
  const allInCategory = getArticlesByCategory(category)

  return (
    <div className="max-w-2xl">
      <nav className="text-sm text-[var(--help-muted)] mb-6 flex gap-2">
        <Link href="/" className="hover:text-[var(--help-text)]">Help</Link>
        <span>/</span>
        <Link href={`/${category}`} className="hover:text-[var(--help-text)] capitalize">{category}</Link>
        <span>/</span>
        <span>{frontmatter.title}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">{frontmatter.title}</h1>
      <p className="text-[var(--help-muted)] mb-8">{frontmatter.description}</p>

      <article className="prose prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_ol]:pl-5 [&_li]:mb-1">
        <MDXRemote source={content} components={mdxComponents} />
      </article>

      {frontmatter.relatedArticles.length > 0 && (
        <div className="mt-12 border-t border-[var(--help-border)] pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--help-muted)] mb-3">
            Related guides
          </h2>
          <div className="flex flex-col gap-2">
            {frontmatter.relatedArticles.map(slug => {
              const related = allInCategory.find(a => a.slug === slug)
              if (!related) return null
              return (
                <Link
                  key={slug}
                  href={`/${category}/${slug}`}
                  className="text-sm text-[var(--help-accent)] hover:underline"
                >
                  {related.frontmatter.title}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run build to verify pages compile**

```bash
cd apps/26help && pnpm install && pnpm build
```

Expected: Build succeeds (no MDX articles yet, so 0 static pages — that's fine)

- [ ] **Step 6: Commit**

```bash
git add apps/26help/src/app/
git commit -m "feat(26help): core layout and pages"
```

---

### Task 4: UI components — VideoGuide, CategoryCard, HelpSearch

**Files:**
- Create: `apps/26help/src/components/VideoGuide.tsx`
- Create: `apps/26help/src/components/HelpSearch.tsx`

- [ ] **Step 1: Create `apps/26help/src/components/VideoGuide.tsx`**

Lazy-loads the video only when it enters the viewport. Uses native `controls` for accessible scrub/pause. `aria-label` for screen readers.

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface VideoGuideProps {
  src: string
  title?: string
}

export function VideoGuide({ src, title }: VideoGuideProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="my-6 rounded-xl overflow-hidden border border-[var(--help-border)] bg-[var(--help-card)]"
      style={{ minHeight: isVisible ? undefined : 200 }}
    >
      {isVisible ? (
        <video
          controls
          playsInline
          preload="metadata"
          aria-label={title ? `Video guide: ${title}` : 'Video guide'}
          className="w-full"
        >
          <source src={`/videos/${src}`} type="video/webm" />
          <p className="p-4 text-sm text-[var(--help-muted)]">
            Your browser doesn't support video playback.{' '}
            <a href={`/videos/${src}`} download className="text-[var(--help-accent)]">
              Download the video
            </a>
            .
          </p>
        </video>
      ) : (
        <div className="flex items-center justify-center h-48 text-[var(--help-muted)] text-sm">
          Loading video…
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/26help/src/components/HelpSearch.tsx`**

Pagefind loads client-side from `/_pagefind/pagefind.js` which is built at deploy time. The component renders an input and calls `pagefind.search()` on input. Falls back gracefully if Pagefind isn't built yet (dev mode).

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

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
    // Load pagefind bundle (built at deploy time)
    const script = document.createElement('script')
    script.src = '/_pagefind/pagefind.js'
    script.type = 'module'
    script.onload = () => setLoaded(true)
    script.onerror = () => { /* dev mode — pagefind not built */ }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  useEffect(() => {
    if (!loaded || !query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const pf = window.pagefind
      if (!pf) return
      const { results } = await pf.search(query)
      const resolved = await Promise.all(
        results.slice(0, 8).map(r => r.data())
      )
      setResults(resolved.map(r => ({
        url: r.url,
        title: r.meta.title,
        excerpt: r.excerpt,
      })))
    }, 200)
  }, [query, loaded])

  return (
    <div className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
        className="w-full rounded-xl border border-[var(--help-border)] bg-[var(--help-card)] px-4 py-3 text-sm outline-none focus:border-[var(--help-accent)] transition-colors"
      />
      {results.length > 0 && (
        <ul className="absolute top-full mt-2 w-full rounded-xl border border-[var(--help-border)] bg-[var(--help-card)] shadow-lg z-50 overflow-hidden divide-y divide-[var(--help-border)]">
          {results.map(r => (
            <li key={r.url}>
              <a
                href={r.url}
                className="block px-4 py-3 hover:bg-[var(--help-bg)] transition-colors"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <p
                  className="text-xs text-[var(--help-muted)] mt-0.5 line-clamp-2"
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
```

- [ ] **Step 3: Wire `HelpSearch` into home page — update `apps/26help/src/app/page.tsx`**

Replace the `<div id="help-search" />` placeholder with the actual component:

```diff
-import Link from 'next/link'
-import { getAllCategories, getArticlesByCategory } from '@/lib/content'
+import Link from 'next/link'
+import { getAllCategories, getArticlesByCategory } from '@/lib/content'
+import { HelpSearch } from '@/components/HelpSearch'

-      {/* Search placeholder — Pagefind hydrates this client-side */}
-      <div id="help-search" className="mb-12" />
+      <div className="mb-12">
+        <HelpSearch />
+      </div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/26help/src/components/
git commit -m "feat(26help): VideoGuide, HelpSearch components"
```

---

### Task 5: SEO — sitemap.xml + metadata

**Files:**
- Create: `apps/26help/src/app/sitemap.ts`

- [ ] **Step 1: Create `apps/26help/src/app/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next'
import { getAllArticles, getAllCategories } from '@/lib/content'

const BASE = 'https://help.relentify.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getAllArticles()
  const categories = getAllCategories()

  const articleUrls = articles.map(article => ({
    url: `${BASE}/${article.category}/${article.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  const categoryUrls = categories.map(category => ({
    url: `${BASE}/${category}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    ...categoryUrls,
    ...articleUrls,
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/26help/src/app/sitemap.ts
git commit -m "feat(26help): auto-generated sitemap"
```

---

### Task 6: MDX articles — 20 accounting articles

**Files:**
- Create: `apps/26help/content/accounting/*.mdx` (20 files)
- Create: `apps/26help/content/fields.ts`

Each article follows the four-section template: **What this does** / **When to use it** / **Step by step** / (video inline) / **Related guides** (via `relatedArticles` frontmatter).

- [ ] **Step 1: Create `apps/26help/content/accounting/create-invoice.mdx`**

This is the reference article — write all others to this standard.

```mdx
---
title: How to Create an Invoice
description: Send a professional payment request to your customer in under a minute.
category: accounting
order: 1
video: create-invoice.webm
appRoute: /dashboard/invoices/new
relatedArticles:
  - record-invoice-payment
  - send-invoice
  - manage-customers
---

## What this does

Creating an invoice records a sale and sends a payment request to your customer.
Relentify tracks the outstanding balance, updates your aged receivables report, and
posts the entry to your general ledger automatically.

## When to use it

Use this whenever you've completed work or delivered goods and need to request payment.
Do not use invoices for internal cost tracking — use expenses for that instead.

## Step by step

1. Go to **Invoices** in the left menu
2. Click **New Invoice** in the top right
3. Type or select your customer name in the **Customer** field
4. Add one or more line items — enter a description, quantity, and unit price for each
5. Set the **Due Date** — this is the date by which your customer must pay
6. Select a **VAT rate** for each line item (use 20% for standard-rated goods and services)
7. Review the total at the bottom right
8. Click **Send** to email the invoice immediately, or **Save as Draft** to review it first

<VideoGuide src="create-invoice.webm" title="How to Create an Invoice" />
```

- [ ] **Step 2: Create the remaining 19 articles**

Create each file below with at minimum the frontmatter and placeholder Step-by-step content that matches the actual UI labels.

`content/accounting/record-invoice-payment.mdx`:
```mdx
---
title: How to Record an Invoice Payment
description: Mark an invoice as paid and keep your accounts receivable up to date.
category: accounting
order: 2
video: record-invoice-payment.webm
appRoute: /dashboard/invoices
relatedArticles:
  - create-invoice
  - bank-reconciliation
---

## What this does

Recording a payment closes the open balance on an invoice and posts a debit to your
bank account and a credit to accounts receivable in the general ledger.

## When to use it

Use this when a customer pays an invoice — whether by bank transfer, card, or cheque.

## Step by step

1. Go to **Invoices** in the left menu
2. Find the invoice and click it to open
3. Click **Record Payment** in the top right
4. Enter the **Payment Date** and **Amount Received**
5. Select the **Bank Account** the payment arrived in
6. Click **Save**

<VideoGuide src="record-invoice-payment.webm" title="Recording an Invoice Payment" />
```

`content/accounting/send-invoice.mdx`:
```mdx
---
title: How to Send an Invoice by Email
description: Email an invoice directly to your customer from Relentify.
category: accounting
order: 3
video: send-invoice.webm
appRoute: /dashboard/invoices
relatedArticles:
  - create-invoice
---

## What this does

Sends a PDF of the invoice to your customer's email address and marks the invoice as Sent.

## When to use it

Use this after creating an invoice when you're ready to request payment.

## Step by step

1. Open the invoice from the **Invoices** list
2. Click **Send** in the top right
3. Confirm or edit the recipient email address
4. Optionally edit the subject line and message body
5. Click **Send Invoice**

<VideoGuide src="send-invoice.webm" title="Sending an Invoice by Email" />
```

`content/accounting/create-quote.mdx`:
```mdx
---
title: How to Create a Quote
description: Send a price estimate to a customer before converting it to an invoice.
category: accounting
order: 4
video: create-quote.webm
appRoute: /dashboard/quotes/new
relatedArticles:
  - convert-quote
  - create-invoice
---

## What this does

A quote is a non-binding price estimate. Once accepted, you can convert it to an invoice with one click.

## When to use it

Use quotes when a customer asks for pricing before committing to a purchase.

## Step by step

1. Go to **Quotes** in the left menu
2. Click **New Quote**
3. Select or type the customer name
4. Add line items with descriptions, quantities, and unit prices
5. Set a **Valid Until** date
6. Click **Send** to email the quote, or **Save** to keep it as a draft

<VideoGuide src="create-quote.webm" title="Creating a Quote" />
```

`content/accounting/convert-quote.mdx`:
```mdx
---
title: How to Convert a Quote to an Invoice
description: Turn an accepted quote into an invoice instantly.
category: accounting
order: 5
video: convert-quote.webm
appRoute: /dashboard/quotes
relatedArticles:
  - create-quote
  - create-invoice
---

## What this does

Copies the quote's line items, customer, and pricing into a new draft invoice.
The quote is marked as Invoiced.

## When to use it

Use this when a customer accepts your quote and you're ready to bill them.

## Step by step

1. Go to **Quotes** and open the accepted quote
2. Click **Convert to Invoice** in the top right
3. Review the invoice details — edit line items or due date if needed
4. Click **Send** or **Save**

<VideoGuide src="convert-quote.webm" title="Converting a Quote to an Invoice" />
```

`content/accounting/create-bill.mdx`:
```mdx
---
title: How to Create a Bill
description: Record a purchase from a supplier and track what you owe.
category: accounting
order: 6
video: create-bill.webm
appRoute: /dashboard/bills/new
relatedArticles:
  - record-bill-payment
  - add-supplier
---

## What this does

A bill records money you owe to a supplier. It posts to accounts payable and appears in your aged payables report.

## When to use it

Use this when you receive an invoice from a supplier.

## Step by step

1. Go to **Bills** in the left menu
2. Click **New Bill**
3. Select or type the supplier name
4. Enter the **Bill Date** (date on the supplier's invoice)
5. Set the **Due Date**
6. Add line items — description, amount, and the expense account it belongs to
7. Click **Save**

<VideoGuide src="create-bill.webm" title="Creating a Bill" />
```

`content/accounting/record-bill-payment.mdx`:
```mdx
---
title: How to Record a Bill Payment
description: Mark a supplier bill as paid and keep your accounts payable current.
category: accounting
order: 7
video: record-bill-payment.webm
appRoute: /dashboard/bills
relatedArticles:
  - create-bill
  - bank-reconciliation
---

## What this does

Closes the open balance on a bill and posts a debit to accounts payable and a credit to your bank account.

## When to use it

Use this when you pay a supplier, whether by bank transfer, card, or cheque.

## Step by step

1. Go to **Bills** and open the unpaid bill
2. Click **Record Payment**
3. Enter the **Payment Date** and **Amount Paid**
4. Select the **Bank Account** you paid from
5. Click **Save**

<VideoGuide src="record-bill-payment.webm" title="Recording a Bill Payment" />
```

`content/accounting/bank-reconciliation.mdx`:
```mdx
---
title: How to Reconcile Bank Transactions
description: Match your bank feed transactions to invoices, bills, and expenses.
category: accounting
order: 8
video: bank-reconciliation.webm
appRoute: /dashboard/banking
relatedArticles:
  - record-invoice-payment
  - record-bill-payment
---

## What this does

Reconciliation matches your actual bank transactions to records in Relentify. It confirms
your books match your bank and keeps your cash balance accurate.

## When to use it

Do this at least weekly — more often if you process many transactions.

## Step by step

1. Go to **Banking** in the left menu
2. Click **Sync** to pull in the latest transactions from your bank
3. For each unmatched transaction, click **Match** to find the corresponding invoice or bill
4. If no match exists, click **Create** to record a new entry
5. Transactions turn green when matched
6. Click **Reconcile** when all transactions are matched

<VideoGuide src="bank-reconciliation.webm" title="Reconciling Bank Transactions" />
```

`content/accounting/add-customer.mdx`:
```mdx
---
title: How to Add a Customer
description: Add a customer so you can create invoices and quotes for them.
category: accounting
order: 9
video: add-customer.webm
appRoute: /dashboard/customers/new
relatedArticles:
  - create-invoice
  - create-quote
---

## What this does

Creates a customer record that can be attached to invoices, quotes, and credit notes.

## When to use it

Add a customer before creating your first invoice for them. You can also add them inline when creating an invoice.

## Step by step

1. Go to **Customers** in the left menu
2. Click **New Customer**
3. Enter the customer's name and email address
4. Optionally add their billing address and phone number
5. Click **Save**

<VideoGuide src="add-customer.webm" title="Adding a Customer" />
```

`content/accounting/add-supplier.mdx`:
```mdx
---
title: How to Add a Supplier
description: Add a supplier so you can record bills and expenses from them.
category: accounting
order: 10
video: add-supplier.webm
appRoute: /dashboard/suppliers/new
relatedArticles:
  - create-bill
  - create-expense
---

## What this does

Creates a supplier record used for bills, purchase orders, and expense tracking.

## When to use it

Add a supplier before recording your first bill from them.

## Step by step

1. Go to **Suppliers** in the left menu
2. Click **New Supplier**
3. Enter the supplier's name and email
4. Optionally add their payment terms and bank details
5. Click **Save**

<VideoGuide src="add-supplier.webm" title="Adding a Supplier" />
```

`content/accounting/create-expense.mdx`:
```mdx
---
title: How to Submit an Expense
description: Record a business expense for reimbursement or accounting purposes.
category: accounting
order: 11
video: create-expense.webm
appRoute: /dashboard/expenses/new
relatedArticles:
  - approve-expense
  - create-mileage
---

## What this does

Records a business expense against an account in your chart of accounts.
If approval is required, the expense goes into a pending queue.

## When to use it

Use this for any business-related spend — meals, travel, software, supplies.

## Step by step

1. Go to **Expenses** in the left menu
2. Click **New Expense**
3. Enter the **Date**, **Description**, and **Gross Amount** (including VAT)
4. Select the **Category** (expense account)
5. Choose the **VAT rate**
6. Optionally attach a receipt
7. Click **Submit**

<VideoGuide src="create-expense.webm" title="Submitting an Expense" />
```

`content/accounting/approve-expense.mdx`:
```mdx
---
title: How to Approve an Expense
description: Review and approve a pending expense submission from your team.
category: accounting
order: 12
video: approve-expense.webm
appRoute: /dashboard/expenses
relatedArticles:
  - create-expense
---

## What this does

Approves a pending expense, marking it as accepted and including it in your accounts.

## When to use it

You'll see pending expenses here when a team member submits one and your settings require approval.

## Step by step

1. Go to **Expenses** and click the **Pending Approval** tab
2. Click on an expense to open it
3. Review the details and attached receipt
4. Click **Approve** or **Reject**
5. If rejecting, enter a reason

<VideoGuide src="approve-expense.webm" title="Approving an Expense" />
```

`content/accounting/create-credit-note.mdx`:
```mdx
---
title: How to Issue a Credit Note
description: Credit a customer for a returned item or billing error.
category: accounting
order: 13
video: create-credit-note.webm
appRoute: /dashboard/credit-notes/new
relatedArticles:
  - create-invoice
  - record-invoice-payment
---

## What this does

A credit note reduces the amount a customer owes you. It posts a debit to revenue and a credit to accounts receivable.

## When to use it

Use this when a customer returns goods, when you've overcharged them, or to issue a goodwill discount.

## Step by step

1. Go to **Credit Notes** in the left menu
2. Click **New Credit Note**
3. Select the customer
4. Add line items matching what you're crediting
5. Click **Save**

<VideoGuide src="create-credit-note.webm" title="Issuing a Credit Note" />
```

`content/accounting/pl-report.mdx`:
```mdx
---
title: How to Read the Profit & Loss Report
description: Understand your income, expenses, and net profit over any period.
category: accounting
order: 14
video: pl-report.webm
appRoute: /dashboard/reports/pl
relatedArticles:
  - balance-sheet
  - trial-balance
---

## What this does

Shows all income and expense accounts for a selected date range, calculating gross profit, operating profit, and net profit.

## When to use it

Review monthly to understand business performance. Use it for tax filings and management accounts.

## Step by step

1. Go to **Reports** → **Profit & Loss**
2. Set the **Start Date** and **End Date**
3. Click **Run Report**
4. Expand any category row to see individual accounts
5. Click **Export** to download as a spreadsheet

<VideoGuide src="pl-report.webm" title="Reading the Profit & Loss Report" />
```

`content/accounting/balance-sheet.mdx`:
```mdx
---
title: How to Read the Balance Sheet
description: See your assets, liabilities, and equity at any point in time.
category: accounting
order: 15
video: balance-sheet.webm
appRoute: /dashboard/reports/balance-sheet
relatedArticles:
  - pl-report
  - trial-balance
---

## What this does

Shows the financial position of your business at a specific date — what you own, what you owe, and what's left over.

## When to use it

Review at year end, before a funding round, or when a bank asks for financial statements.

## Step by step

1. Go to **Reports** → **Balance Sheet**
2. Set the **As At** date
3. Click **Run Report**
4. Assets are shown first, then liabilities, then equity
5. Assets must equal Liabilities + Equity — if they don't, check your opening balances

<VideoGuide src="balance-sheet.webm" title="Reading the Balance Sheet" />
```

`content/accounting/trial-balance.mdx`:
```mdx
---
title: How to Run a Trial Balance
description: List all account balances and verify your books are in balance.
category: accounting
order: 16
video: trial-balance.webm
appRoute: /dashboard/reports/trial-balance
relatedArticles:
  - pl-report
  - balance-sheet
---

## What this does

Lists every account in your chart of accounts with its debit or credit balance for the period. Total debits must equal total credits.

## When to use it

Run before preparing year-end accounts or when investigating a discrepancy.

## Step by step

1. Go to **Reports** → **Trial Balance**
2. Set the **Period End** date
3. Click **Run Report**
4. Check that the Total Debits and Total Credits rows match
5. Drill into any account by clicking its row

<VideoGuide src="trial-balance.webm" title="Running a Trial Balance" />
```

`content/accounting/vat-return.mdx`:
```mdx
---
title: How to Calculate a VAT Return
description: Generate your nine-box VAT return for HMRC submission.
category: accounting
order: 17
video: vat-return.webm
appRoute: /dashboard/vat
relatedArticles:
  - create-invoice
  - create-bill
---

## What this does

Calculates the nine boxes of your VAT return based on transactions in the period,
using standard UK VAT accounting.

## When to use it

At the end of each VAT period (usually quarterly).

## Step by step

1. Go to **VAT** in the left menu
2. Set the **Period Start** and **Period End** dates
3. Click **Calculate**
4. Review each of the nine boxes — hover over a box to see which transactions contributed
5. When satisfied, click **Mark as Filed** to lock the period

<VideoGuide src="vat-return.webm" title="Calculating a VAT Return" />
```

`content/accounting/import-opening-balances.mdx`:
```mdx
---
title: How to Import Opening Balances
description: Set up your starting account balances when migrating from another system.
category: accounting
order: 18
video: import-opening-balances.webm
appRoute: /dashboard/settings/opening-balances
relatedArticles:
  - trial-balance
  - create-journal
---

## What this does

Imports account opening balances from a CSV file, setting up your chart of accounts so your P&L and balance sheet start from the correct position.

## When to use it

Use this once, when you first set up Relentify after migrating from another accounting system or spreadsheet.

## Step by step

1. Go to **Settings** → **Opening Balances**
2. Download the CSV template
3. Fill in each account code and its opening balance (positive for debit, negative for credit)
4. Upload the completed CSV
5. Review the preview — check that total debits equal total credits
6. Click **Import**

<VideoGuide src="import-opening-balances.webm" title="Importing Opening Balances" />
```

`content/accounting/invite-team-member.mdx`:
```mdx
---
title: How to Invite a Team Member
description: Give a colleague access to your Relentify account with a specific role.
category: accounting
order: 19
video: invite-team-member.webm
appRoute: /dashboard/settings/team
relatedArticles: []
---

## What this does

Sends an email invitation to a colleague. When they accept, they get access to your account with the role you assign.

## When to use it

Use this when onboarding a bookkeeper, accountant, or team member who needs access.

## Step by step

1. Go to **Settings** → **Team**
2. Click **Invite Member**
3. Enter their email address
4. Select a **Role** — Admin, Accountant, or Member
5. Click **Send Invite**
6. They'll receive an email with a link to create their account

<VideoGuide src="invite-team-member.webm" title="Inviting a Team Member" />
```

`content/accounting/create-journal.mdx`:
```mdx
---
title: How to Create a Manual Journal Entry
description: Post a custom debit/credit entry directly to the general ledger.
category: accounting
order: 20
video: create-journal.webm
appRoute: /dashboard/journals/new
relatedArticles:
  - trial-balance
  - import-opening-balances
---

## What this does

Posts a balanced debit/credit entry to one or more accounts. Journal entries appear in the general ledger and all reports immediately.

## When to use it

Use for accruals, adjustments, prepayments, and corrections. Do not use journals to record sales or purchases — use invoices and bills for those.

## Step by step

1. Go to **Journals** in the left menu
2. Click **New Journal**
3. Set the **Journal Date**
4. Add lines — for each line, select an account code, enter a debit or credit amount
5. The entry must balance: total debits must equal total credits
6. Add a **Memo** explaining the purpose of the journal
7. Click **Post**

<VideoGuide src="create-journal.webm" title="Creating a Manual Journal Entry" />
```

- [ ] **Step 3: Create `apps/26help/content/fields.ts`**

Used by `HelpTooltip` in 22accounting. Keys match the `field` prop passed to `<HelpTooltip field="dueDate" />`.

```ts
/** Maps field keys to one-sentence tooltip descriptions.
 *  Consumed by apps/22accounting/app/components/HelpTooltip.tsx */
export const fieldDescriptions: Record<string, string> = {
  dueDate: 'The date by which your customer must pay.',
  invoiceDate: 'The date the invoice was issued — this is the tax point for VAT.',
  billDate: "The date shown on your supplier's invoice.",
  vatRate: 'The VAT rate applied to this line item. Use 20% for standard-rated goods.',
  accountCode: 'The chart of accounts category this transaction belongs to.',
  grossAmount: 'The total amount including VAT.',
  netAmount: 'The amount before VAT is applied.',
  validUntil: 'The date after which this quote is no longer valid.',
  paymentReference: 'A reference your customer should quote when making payment.',
  fromLocation: 'The starting point of the journey for mileage reimbursement.',
  toLocation: 'The destination of the journey for mileage reimbursement.',
  miles: 'The total distance in miles for this journey.',
  rate: 'The per-mile reimbursement rate in pence (HMRC advisory rate is 45p/mile).',
  openingBalance: 'The account balance at the start of your accounting period.',
  journalMemo: 'A note explaining why this journal entry was posted — required for audit trail.',
}
```

- [ ] **Step 4: Run build to verify all 20 articles compile with no Zod errors**

```bash
cd apps/26help && pnpm build
```

Expected: Build succeeds, 20+ static pages generated, no frontmatter validation errors

- [ ] **Step 5: Commit**

```bash
git add apps/26help/content/
git commit -m "feat(26help): 20 accounting articles + field descriptions"
```

---

### Task 7: Pagefind — build-time search index

**Files:**
- Modify: `apps/26help/package.json` (already has `build:search` script)
- Modify: `apps/26help/Dockerfile` (Task 8 below runs pagefind in the build stage)

- [ ] **Step 1: Verify pagefind CLI works on the static output**

```bash
cd apps/26help && pnpm build && npx pagefind --site out --output-path out/_pagefind
```

Expected: `pagefind` outputs `Indexed N pages`, creates `out/_pagefind/` with `pagefind.js`

- [ ] **Step 2: Test `HelpSearch` in browser**

```bash
cd apps/26help && npx serve out -p 3026
```

Open `http://localhost:3026`, type "invoice" in the search box.
Expected: Search results appear with article titles and excerpts.

- [ ] **Step 3: Commit** (no code changes needed — `build:search` script already in package.json)

```bash
git add apps/26help/
git commit -m "feat(26help): verify Pagefind search integration"
```

---

### Task 8: Dockerfile + docker-compose.yml

**Files:**
- Create: `apps/26help/Dockerfile`
- Create: `apps/26help/docker-compose.yml`

- [ ] **Step 1: Create `apps/26help/Dockerfile`**

The build stage runs turbo prune, installs deps, builds Next.js, then runs pagefind on `out/`.
The runtime stage is a lightweight Node image that serves the static `out/` directory.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune 26help --docker

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/apps/26help/node_modules ./apps/26help/node_modules
WORKDIR /app/apps/26help
RUN pnpm build
# Run Pagefind to index the static output
RUN npx pagefind --site out --output-path out/_pagefind

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/apps/26help/out ./out
EXPOSE 3000
CMD ["serve", "out", "-p", "3000", "--single"]
```

- [ ] **Step 2: Create `apps/26help/docker-compose.yml`**

```yaml
services:
  web:
    build:
      context: ../../
      dockerfile: apps/26help/Dockerfile
    container_name: 26help
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 256M
    ports:
      - "3026:3000"
    networks:
      - infra_default
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:3000/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  infra_default:
    external: true
    name: infra_default
```

- [ ] **Step 3: Commit**

```bash
git add apps/26help/Dockerfile apps/26help/docker-compose.yml
git commit -m "feat(26help): Dockerfile and docker-compose"
```

---

### Task 9: Playwright recording runner

**Files:**
- Create: `apps/26help/playwright/record.ts`

The runner logs into 22accounting, runs the named script, captures video via Playwright's `recordVideo`, then compresses with ffmpeg using `-crf 28 -preset veryfast` for small file sizes. ChatGPT improvement #5.

- [ ] **Step 1: Install ffmpeg on the recording machine (not in Docker)**

```bash
apt-get install -y ffmpeg
# Verify:
ffmpeg -version
```

- [ ] **Step 2: Create `apps/26help/playwright/record.ts`**

```ts
import { chromium } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env') })

const SCRIPT_NAME = process.argv[2]
if (!SCRIPT_NAME) {
  console.error('Usage: ts-node record.ts <script-name>')
  console.error('Example: ts-node record.ts create-invoice')
  process.exit(1)
}

const SCRIPTS_DIR = path.join(__dirname, 'scripts')
const TMP_DIR = path.join(__dirname, '../tmp-videos')
const OUTPUT_DIR = path.join(__dirname, '../public/videos')

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3022'
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD in .env')
  process.exit(1)
}

async function run() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: TMP_DIR,
      size: { width: 1280, height: 720 },
    },
  })

  const page = await context.newPage()

  // Log in
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard**`)

  // Run the feature script
  const scriptPath = path.join(SCRIPTS_DIR, `${SCRIPT_NAME}.ts`)
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`)
    process.exit(1)
  }
  const { run: runScript } = await import(scriptPath)
  await runScript(page, BASE_URL)

  // Pause 1s at end so the final state is visible
  await page.waitForTimeout(1000)

  await context.close()
  await browser.close()

  // Find the recorded file
  const files = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.webm'))
  if (files.length === 0) {
    console.error('No video recorded')
    process.exit(1)
  }
  const rawPath = path.join(TMP_DIR, files[0])
  const outputPath = path.join(OUTPUT_DIR, `${SCRIPT_NAME}.webm`)

  // Compress with ffmpeg: VP9, CRF 28, fast preset (~70% smaller than raw)
  console.log(`Compressing ${rawPath} → ${outputPath}`)
  execSync(
    `ffmpeg -i "${rawPath}" -c:v libvpx-vp9 -crf 28 -b:v 0 -deadline realtime -cpu-used 5 "${outputPath}" -y`,
    { stdio: 'inherit' }
  )

  // Clean up raw file
  fs.unlinkSync(rawPath)

  console.log(`✅ Saved: ${outputPath}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Add a `record` npm script to `apps/26help/package.json`**

```diff
   "scripts": {
     "dev": "next dev -p 3026",
     "build": "next build",
     "start": "serve out -p 3026",
     "lint": "next lint",
+    "record": "ts-node -T playwright/record.ts",
+    "validate": "ts-node -T playwright/validate.ts",
     "build:search": "next build && npx pagefind --site out --output-path out/_pagefind"
   },
```

- [ ] **Step 4: Commit**

```bash
git add apps/26help/playwright/record.ts apps/26help/package.json
git commit -m "feat(26help): Playwright recording runner with ffmpeg compression"
```

---

### Task 10: Playwright scripts — 20 recording scripts

**Files:**
- Create: `apps/26help/playwright/scripts/*.ts` (20 files)

Each script exports a `run(page, baseUrl)` function. Scripts should use `waitForSelector` not hard sleeps — they work on real elements so they serve double duty as a CI validator.

- [ ] **Step 1: Create `apps/26help/playwright/scripts/create-invoice.ts`**

```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices/new`)
  // Select customer
  await page.waitForSelector('[data-testid="customer-input"], input[placeholder*="customer" i]')
  await page.click('[data-testid="customer-input"], input[placeholder*="customer" i]')
  await page.waitForTimeout(400)
  // Add a line item
  await page.waitForSelector('button:has-text("Add line item"), button:has-text("Add item")')
  await page.click('button:has-text("Add line item"), button:has-text("Add item")')
  await page.waitForTimeout(300)
  // Fill description
  const descInput = page.locator('input[placeholder*="Description" i], input[placeholder*="Item" i]').first()
  await descInput.fill('Consulting services')
  // Fill unit price
  const priceInput = page.locator('input[placeholder*="price" i], input[placeholder*="amount" i]').first()
  await priceInput.fill('500')
  // Pause on filled form
  await page.waitForTimeout(1000)
  // Click Save (don't actually submit in recording)
  await page.waitForSelector('button:has-text("Save"), button:has-text("Save as Draft")')
}
```

- [ ] **Step 2: Create the remaining 19 scripts**

`apps/26help/playwright/scripts/record-invoice-payment.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices`)
  await page.waitForSelector('table tbody tr, [data-testid="invoice-row"]')
  await page.click('table tbody tr:first-child, [data-testid="invoice-row"]:first-child')
  await page.waitForSelector('button:has-text("Record Payment")')
  await page.click('button:has-text("Record Payment")')
  await page.waitForSelector('input[name="amount"], input[placeholder*="amount" i]')
  await page.fill('input[name="amount"], input[placeholder*="amount" i]', '500')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/send-invoice.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/invoices`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Send")')
  await page.click('button:has-text("Send")')
  await page.waitForSelector('[role="dialog"], form:has(input[type="email"])')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/create-quote.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/quotes/new`)
  await page.waitForSelector('input[placeholder*="customer" i], [data-testid="customer-input"]')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Add"), button:has-text("Add line item")')
  await page.waitForTimeout(400)
  await page.locator('input[placeholder*="Description" i]').first().fill('Website design')
  await page.locator('input[placeholder*="price" i], input[placeholder*="amount" i]').first().fill('1200')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/convert-quote.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/quotes`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Convert to Invoice")')
  await page.click('button:has-text("Convert to Invoice")')
  await page.waitForSelector('[data-testid="invoice-form"], form')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/create-bill.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/bills/new`)
  await page.waitForSelector('input[placeholder*="supplier" i], [data-testid="supplier-input"]')
  await page.waitForTimeout(500)
  await page.locator('input[placeholder*="Description" i], input[placeholder*="Item" i]').first().fill('Office supplies')
  await page.locator('input[placeholder*="amount" i], input[placeholder*="price" i]').first().fill('120')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/record-bill-payment.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/bills`)
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Record Payment")')
  await page.click('button:has-text("Record Payment")')
  await page.waitForSelector('input[name="amount"], input[placeholder*="amount" i]')
  await page.fill('input[name="amount"], input[placeholder*="amount" i]', '120')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/bank-reconciliation.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/banking`)
  await page.waitForSelector('button:has-text("Sync"), [data-testid="sync-button"]')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Sync"), [data-testid="sync-button"]')
  await page.waitForTimeout(1200)
  // Show unmatched transactions
  await page.waitForSelector('[data-testid="transaction-row"], table tbody tr')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/add-customer.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/customers/new`)
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]')
  await page.fill('input[name="name"], input[placeholder*="name" i]', 'Acme Ltd')
  await page.fill('input[type="email"]', 'billing@acme.com')
  await page.waitForTimeout(800)
  await page.waitForSelector('button[type="submit"], button:has-text("Save")')
}
```

`apps/26help/playwright/scripts/add-supplier.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/suppliers/new`)
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]')
  await page.fill('input[name="name"], input[placeholder*="name" i]', 'Office Direct Ltd')
  await page.fill('input[type="email"]', 'accounts@officedirect.com')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/create-expense.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/expenses/new`)
  await page.waitForSelector('input[name="description"], input[placeholder*="description" i]')
  await page.fill('input[name="description"], input[placeholder*="description" i]', 'Team lunch')
  await page.fill('input[name="grossAmount"], input[placeholder*="amount" i]', '48.00')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/approve-expense.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/expenses`)
  await page.waitForSelector('[role="tab"]:has-text("Pending"), button:has-text("Pending")')
  await page.click('[role="tab"]:has-text("Pending"), button:has-text("Pending")')
  await page.waitForSelector('table tbody tr')
  await page.click('table tbody tr:first-child')
  await page.waitForSelector('button:has-text("Approve")')
  await page.waitForTimeout(600)
  await page.click('button:has-text("Approve")')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/create-credit-note.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/credit-notes/new`)
  await page.waitForSelector('input[placeholder*="customer" i], [data-testid="customer-input"]')
  await page.waitForTimeout(400)
  await page.locator('input[placeholder*="Description" i]').first().fill('Returned goods')
  await page.locator('input[placeholder*="amount" i], input[placeholder*="price" i]').first().fill('200')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/pl-report.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/reports/pl`)
  await page.waitForSelector('button:has-text("Run"), button:has-text("Generate")')
  await page.click('button:has-text("Run"), button:has-text("Generate")')
  await page.waitForSelector('[data-testid="report-table"], table')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/balance-sheet.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/reports/balance-sheet`)
  await page.waitForSelector('button:has-text("Run"), button:has-text("Generate")')
  await page.click('button:has-text("Run"), button:has-text("Generate")')
  await page.waitForSelector('[data-testid="report-table"], table')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/trial-balance.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/reports/trial-balance`)
  await page.waitForSelector('button:has-text("Run"), button:has-text("Generate")')
  await page.click('button:has-text("Run"), button:has-text("Generate")')
  await page.waitForSelector('[data-testid="report-table"], table')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/vat-return.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/vat`)
  await page.waitForSelector('button:has-text("Calculate"), button:has-text("Run")')
  await page.click('button:has-text("Calculate"), button:has-text("Run")')
  await page.waitForSelector('[data-testid="vat-boxes"], [data-testid="vat-return"]')
  await page.waitForTimeout(1200)
}
```

`apps/26help/playwright/scripts/import-opening-balances.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/settings`)
  await page.waitForSelector('a:has-text("Opening Balances"), [href*="opening-balances"]')
  await page.click('a:has-text("Opening Balances"), [href*="opening-balances"]')
  await page.waitForSelector('button:has-text("Download template"), input[type="file"]')
  await page.waitForTimeout(1000)
}
```

`apps/26help/playwright/scripts/invite-team-member.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/settings/team`)
  await page.waitForSelector('button:has-text("Invite")')
  await page.click('button:has-text("Invite")')
  await page.waitForSelector('[role="dialog"] input[type="email"]')
  await page.fill('[role="dialog"] input[type="email"]', 'colleague@example.com')
  await page.waitForTimeout(800)
}
```

`apps/26help/playwright/scripts/create-journal.ts`:
```ts
import type { Page } from '@playwright/test'

export async function run(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/dashboard/journals/new`)
  await page.waitForSelector('[data-testid="journal-line"], button:has-text("Add line")')
  await page.waitForTimeout(400)
  const firstLine = page.locator('[data-testid="journal-line"]').first()
  await firstLine.locator('input').first().fill('4000')
  await firstLine.locator('input[placeholder*="debit" i]').fill('1000')
  await page.waitForTimeout(800)
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/26help/playwright/scripts/
git commit -m "feat(26help): 20 Playwright recording scripts"
```

---

### Task 11: Playwright CI validator

ChatGPT improvement #1: automated test that runs all scripts in dry-run mode and fails the build if any UI element is missing.

**Files:**
- Create: `apps/26help/playwright/validate.ts`

- [ ] **Step 1: Create `apps/26help/playwright/validate.ts`**

```ts
import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env') })

const SCRIPTS_DIR = path.join(__dirname, 'scripts')
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3022'
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? ''

interface ValidationResult {
  script: string
  passed: boolean
  error?: string
}

async function validateAll() {
  if (!EMAIL || !PASSWORD) {
    console.error('PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD must be set')
    process.exit(1)
  }

  const scripts = fs
    .readdirSync(SCRIPTS_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => f.replace('.ts', ''))

  console.log(`Validating ${scripts.length} scripts against ${BASE_URL}\n`)

  const results: ValidationResult[] = []

  for (const scriptName of scripts) {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()

    try {
      // Log in
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL(`${BASE_URL}/dashboard**`, { timeout: 10000 })

      // Run script (no recording — just validates selectors work)
      const { run } = await import(path.join(SCRIPTS_DIR, `${scriptName}.ts`))
      await run(page, BASE_URL)

      results.push({ script: scriptName, passed: true })
      process.stdout.write(`  ✅ ${scriptName}\n`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ script: scriptName, passed: false, error: message })
      process.stdout.write(`  ❌ ${scriptName}: ${message}\n`)
    } finally {
      await context.close()
      await browser.close()
    }
  }

  const failed = results.filter(r => !r.passed)
  console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`)

  if (failed.length > 0) {
    console.error(`\nFailing scripts (UI may have changed):`)
    failed.forEach(r => console.error(`  ${r.script}: ${r.error}`))
    process.exit(1)
  }

  console.log('\nAll scripts valid ✅')
}

validateAll().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the validator against a live 22accounting instance**

Ensure 22accounting is running, then:

```bash
cd apps/26help && pnpm validate
```

Expected: All 20 scripts pass. If a script fails, update the selector in `playwright/scripts/<name>.ts` to match the actual UI element.

- [ ] **Step 3: Commit**

```bash
git add apps/26help/playwright/validate.ts
git commit -m "feat(26help): Playwright CI validator"
```

---

### Task 12: In-app integration — HelpButton + auto-generated helpUrlMap

**Files:**
- Create: `apps/22accounting/app/components/HelpButton.tsx`
- Create: `apps/22accounting/app/lib/help-urls.ts`
- Modify: `apps/22accounting/app/dashboard/layout.tsx`

- [ ] **Step 1: Create `apps/22accounting/app/lib/help-urls.ts`**

This is the auto-generated mapping (ChatGPT improvement #3). At build time, it reads all MDX articles from the 26help content directory and builds the route → help URL map from `appRoute` frontmatter fields.

```ts
// Generated at build time from apps/26help/content/*/[slug].mdx appRoute frontmatter.
// To update: add `appRoute: /dashboard/your-route` to the relevant MDX file.
// DO NOT edit this mapping manually.

import path from 'path'
import { getAllArticles, generateHelpMap } from '../../../26help/src/lib/content'

// We read from 26help's content directory at build time
process.chdir(path.join(__dirname, '../../../26help'))
const articles = getAllArticles()
process.chdir(path.join(__dirname, '../../..'))

export const helpUrlMap: Record<string, string> = generateHelpMap(articles)
```

Note: `process.chdir` is needed because `content.ts` uses `process.cwd()` to find the content directory. Alternatively, refactor `getAllArticles` to accept a `contentDir` parameter. Use this simpler approach:

**Revised `apps/22accounting/app/lib/help-urls.ts`** (no chdir needed):

```ts
// Auto-generated: maps 22accounting dashboard routes to help.relentify.com article paths.
// Source of truth: apps/26help/content/*/*.mdx frontmatter (appRoute field).
// Run `pnpm generate:help-urls` to regenerate after adding articles.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const HELP_CONTENT = path.join(process.cwd(), '..', '26help', 'content')

function generateHelpMap(): Record<string, string> {
  const map: Record<string, string> = {}
  if (!fs.existsSync(HELP_CONTENT)) return map

  const categories = fs.readdirSync(HELP_CONTENT).filter(f =>
    fs.statSync(path.join(HELP_CONTENT, f)).isDirectory()
  )

  for (const category of categories) {
    const dir = path.join(HELP_CONTENT, category)
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.mdx'))) {
      const slug = file.replace('.mdx', '')
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const { data } = matter(raw)
      if (data.appRoute) {
        map[data.appRoute] = `/${category}/${slug}`
      }
    }
  }
  return map
}

export const helpUrlMap: Record<string, string> = generateHelpMap()
```

Add `gray-matter` to 22accounting's dependencies:

```bash
cd apps/22accounting && pnpm add gray-matter
```

- [ ] **Step 2: Create `apps/22accounting/app/components/HelpButton.tsx`**

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { helpUrlMap } from '@/app/lib/help-urls'

const HELP_BASE = 'https://help.relentify.com'

export function HelpButton() {
  const pathname = usePathname()
  const articlePath = helpUrlMap[pathname] ?? '/'

  return (
    <a
      href={`${HELP_BASE}${articlePath}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open help documentation"
      title="Help"
      className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-hover)] transition-colors"
    >
      <HelpCircle size={16} />
    </a>
  )
}
```

- [ ] **Step 3: Add `HelpButton` to the dashboard layout**

In `apps/22accounting/app/dashboard/layout.tsx`, import `HelpButton` and add it to the `TopBar` right section, next to the Settings link:

```diff
+import { HelpButton } from '@/app/components/HelpButton'

 // Inside the TopBar rightContent, before UserMenu:
               <TopBarLink href="/dashboard/settings" active={isActive('/dashboard/settings')} aria-label="Settings">
                 <Settings size={14} />
               </TopBarLink>
+              <HelpButton />
             </>
           }
         >
           <UserMenu name={userName}>
```

- [ ] **Step 4: Verify HelpButton renders and links correctly**

Start 22accounting dev server and navigate to `/dashboard/invoices/new`. The `?` button in the nav bar should be present. Click it — it should open `https://help.relentify.com/accounting/create-invoice` in a new tab.

- [ ] **Step 5: Commit**

```bash
git add apps/22accounting/app/components/HelpButton.tsx apps/22accounting/app/lib/help-urls.ts apps/22accounting/app/dashboard/layout.tsx
git commit -m "feat(22accounting): HelpButton with auto-generated route→article mapping"
```

---

### Task 13: Contextual HelpTooltip

ChatGPT improvement #4: `HelpTooltip` reads descriptions from the central `fields.ts` file, so adding a new field tooltip requires only one change in one place.

**Files:**
- Create: `apps/22accounting/app/components/HelpTooltip.tsx`

- [ ] **Step 1: Create `apps/22accounting/app/components/HelpTooltip.tsx`**

Uses the existing `Tooltip` components from `@relentify/ui`. Keyboard accessible via `tabIndex` and `aria-label` (ChatGPT improvement #6).

```tsx
'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@relentify/ui'
import { Info } from 'lucide-react'

// Import field descriptions from 26help's content.
// This is the single source of truth for all tooltip text.
import { fieldDescriptions } from '../../../26help/content/fields'

interface HelpTooltipProps {
  /** Key matching an entry in fieldDescriptions (e.g. "dueDate", "vatRate") */
  field: string
}

export function HelpTooltip({ field }: HelpTooltipProps) {
  const text = fieldDescriptions[field]
  if (!text) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={0}
            aria-label={`Help: ${field}`}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
          >
            <Info size={11} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Add `HelpTooltip` to the invoice Due Date field**

Find the due date field in the new invoice form — likely `apps/22accounting/app/dashboard/invoices/new/page.tsx` or a shared form component. Add the tooltip next to the label:

```diff
-<label htmlFor="dueDate">Due date</label>
+<label htmlFor="dueDate" className="flex items-center gap-1">
+  Due date
+  <HelpTooltip field="dueDate" />
+</label>
```

Run: Start dev server and open a new invoice. Hover the `ⓘ` icon next to "Due date".
Expected: Tooltip shows "The date by which your customer must pay."

- [ ] **Step 3: Commit**

```bash
git add apps/22accounting/app/components/HelpTooltip.tsx
git commit -m "feat(22accounting): HelpTooltip with centralized field descriptions"
```

---

### Task 14: Analytics — track article access

ChatGPT improvement #9: lightweight click tracking so the team can see which help articles are most useful.

**Files:**
- Modify: `apps/26help/src/app/[category]/[article]/page.tsx`
- Modify: `apps/26help/src/app/layout.tsx`

- [ ] **Step 1: Add PostHog pageview tracking to `apps/26help/src/app/layout.tsx`**

26help is a static public site — use a lightweight analytics script. Since 22accounting already uses PostHog, reuse the same project key.

First, add PostHog key to `.env.example`:

```diff
+# Analytics
+NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
+NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

Then create `apps/26help/src/components/Analytics.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Record<string, unknown>) => void
      init: (key: string, opts: Record<string, unknown>) => void
    }
  }
}

export function Analytics() {
  const pathname = usePathname()
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com'

  useEffect(() => {
    if (!key) return
    const script = document.createElement('script')
    script.src = `${host}/static/array.js`
    script.async = true
    script.onload = () => {
      window.posthog?.init(key, { api_host: host, autocapture: false, capture_pageview: false })
    }
    document.head.appendChild(script)
  }, [key, host])

  useEffect(() => {
    if (!window.posthog) return
    window.posthog.capture('$pageview', { $current_url: window.location.href })
  }, [pathname])

  return null
}
```

Add `<Analytics />` to `apps/26help/src/app/layout.tsx`:

```diff
+import { Analytics } from '@/components/Analytics'

 export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
     <html lang="en">
       <body className="...">
+        <Analytics />
         <header>...
```

- [ ] **Step 2: Commit**

```bash
git add apps/26help/src/components/Analytics.tsx apps/26help/src/app/layout.tsx apps/26help/.env.example
git commit -m "feat(26help): PostHog pageview analytics"
```

---

### Task 15: Caddy block + deploy

**Files:**
- Modify: `/opt/infra/caddy/Caddyfile`

- [ ] **Step 1: Add `help.relentify.com` block to Caddyfile**

Open `/opt/infra/caddy/Caddyfile` and add after the `accounting.relentify.com` block:

```
help.relentify.com {
    reverse_proxy 26help:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

- [ ] **Step 2: Validate Caddyfile**

```bash
docker exec infra-caddy caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration`

- [ ] **Step 3: Build and start 26help container**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/26help/docker-compose.yml build --no-cache
docker compose -f apps/26help/docker-compose.yml up -d
docker logs 26help --tail 30
```

Expected: Container starts, `serve` running on port 3000, no errors.

- [ ] **Step 4: Reload Caddy**

```bash
docker exec infra-caddy caddy reload --config /etc/caddy/Caddyfile
```

- [ ] **Step 5: Smoke test**

```bash
curl -I https://help.relentify.com
# Expected: HTTP 200

curl -s https://help.relentify.com/accounting/create-invoice/ | grep -o "<title>[^<]*"
# Expected: <title>How to Create an Invoice — Relentify Help</title>

curl -s https://help.relentify.com/sitemap.xml | head -5
# Expected: <?xml version...

# Test search bundle exists
curl -I https://help.relentify.com/_pagefind/pagefind.js
# Expected: HTTP 200
```

- [ ] **Step 6: Rebuild 22accounting to pick up HelpButton and HelpTooltip**

```bash
cd /opt/relentify-monorepo
docker compose -f apps/22accounting/docker-compose.yml build --no-cache
docker compose -f apps/22accounting/docker-compose.yml up -d
docker logs 22accounting --tail 30
```

Expected: Build succeeds, container healthy.

- [ ] **Step 7: Clean up build cache**

```bash
docker builder prune -f
```

- [ ] **Step 8: Final commit**

```bash
git add /opt/infra/caddy/Caddyfile
git commit -m "feat(infra): add help.relentify.com Caddy block"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ New `apps/26help` with MDX content system (Task 1–6)
- ✅ Zod frontmatter validation (Task 2) — ChatGPT #2
- ✅ Pagefind search (Task 7)
- ✅ Video guides with ffmpeg compression (Task 9) — ChatGPT #5
- ✅ Playwright CI validator (Task 11) — ChatGPT #1
- ✅ HelpButton with auto-generated helpUrlMap (Task 12) — ChatGPT #3
- ✅ HelpTooltip with field descriptions (Task 13) — ChatGPT #4
- ✅ VideoGuide lazy loading + native controls accessibility (Task 4) — ChatGPT #6
- ✅ Analytics (Task 14) — ChatGPT #9
- ✅ Caddy + deploy (Task 15)
- ✅ SEO + sitemap (Task 5)
- ✅ 20 Playwright scripts (Task 10)
- ✅ Docker container (Task 8)

**Not in scope (correct per YAGNI):**
- Pagefind category-split index (ChatGPT #7) — only needed for 500+ articles; note in HelpSearch.tsx comment when the time comes
- Whisper auto-captions (ChatGPT #6 partial) — requires audio; videos are silent so not applicable

**Type consistency check:**
- `ArticleFrontmatter` defined in `content.ts`, used in `page.tsx` files and `generateHelpMap`
- `generateHelpMap` accepts `Article[]` (not raw objects) — consistent with `getAllArticles()` return type
- `fieldDescriptions` is `Record<string, string>` — `HelpTooltip` reads same type
- `run(page: Page, baseUrl: string)` signature — consistent across all 20 scripts and both record.ts and validate.ts
