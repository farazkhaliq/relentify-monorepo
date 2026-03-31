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

/** Auto-generate route → help URL mapping from articles with appRoute frontmatter. */
export function generateHelpMap(articles: Article[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { frontmatter, category, slug } of articles) {
    if (frontmatter.appRoute) {
      map[frontmatter.appRoute] = `/${category}/${slug}`
    }
  }
  return map
}
