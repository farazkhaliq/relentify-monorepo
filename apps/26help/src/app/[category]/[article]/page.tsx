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
      <nav className="text-sm text-[var(--theme-text-muted)] mb-6 flex gap-2">
        <Link href="/" className="hover:text-[var(--theme-text)]">Help</Link>
        <span>/</span>
        <Link href={`/${category}`} className="hover:text-[var(--theme-text)] capitalize">{category}</Link>
        <span>/</span>
        <span>{frontmatter.title}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">{frontmatter.title}</h1>
      <p className="text-[var(--theme-text-muted)] mb-8">{frontmatter.description}</p>

      <article className="prose prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_ol]:pl-5 [&_li]:mb-1">
        <MDXRemote source={content} components={mdxComponents} />
      </article>

      {frontmatter.relatedArticles.length > 0 && (
        <div className="mt-12 border-t border-[var(--theme-border)] pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--theme-text-muted)] mb-3">
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
                  className="text-sm text-[var(--theme-accent)] hover:underline"
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
