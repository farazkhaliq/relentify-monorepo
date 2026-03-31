import type { MetadataRoute } from 'next'
import { getAllArticles, getAllCategories } from '@/lib/content'

export const dynamic = 'force-static'

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
