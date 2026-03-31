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
      <nav className="text-sm text-[var(--theme-text-muted)] mb-6">
        <Link href="/" className="hover:text-[var(--theme-text)]">Help</Link>
        <span className="mx-2">/</span>
        <span className="capitalize">{category}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>
      <div className="divide-y divide-[var(--theme-border)]">
        {articles.map(article => (
          <Link
            key={article.slug}
            href={`/${category}/${article.slug}`}
            className="block py-4 hover:text-[var(--theme-accent)] transition-colors"
          >
            <p className="font-medium">{article.frontmatter.title}</p>
            <p className="text-sm text-[var(--theme-text-muted)] mt-1">{article.frontmatter.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
