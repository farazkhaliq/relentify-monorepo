import pool from '../pool'

export interface Article {
  id: string
  entity_id: string
  title: string
  slug: string
  body: string
  category: string
  sort_order: number
  published: boolean
  language: string
  created_at: string
  updated_at: string
}

export async function listArticles(entityId: string, filters: { category?: string; published?: boolean } = {}): Promise<Article[]> {
  const conditions = ['entity_id = $1']
  const params: any[] = [entityId]
  let idx = 2

  if (filters.category) {
    conditions.push(`category = $${idx++}`)
    params.push(filters.category)
  }
  if (filters.published !== undefined) {
    conditions.push(`published = $${idx++}`)
    params.push(filters.published)
  }

  const result = await pool.query(
    `SELECT * FROM chat_knowledge_articles WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, title ASC`,
    params
  )
  return result.rows
}

export async function getArticleById(id: string, entityId: string): Promise<Article | null> {
  const result = await pool.query(
    'SELECT * FROM chat_knowledge_articles WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return result.rows[0] || null
}

export async function getArticleBySlug(slug: string, entityId: string): Promise<Article | null> {
  const result = await pool.query(
    'SELECT * FROM chat_knowledge_articles WHERE slug = $1 AND entity_id = $2',
    [slug, entityId]
  )
  return result.rows[0] || null
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80)
}

export async function createArticle(entityId: string, data: {
  title: string; body: string; category?: string; published?: boolean; language?: string; sort_order?: number
}): Promise<Article> {
  const slug = generateSlug(data.title)

  const result = await pool.query(
    `INSERT INTO chat_knowledge_articles (entity_id, title, slug, body, category, published, language, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [entityId, data.title, slug, data.body, data.category || 'General', data.published ?? false, data.language || 'en', data.sort_order ?? 0]
  )
  return result.rows[0]
}

export async function updateArticle(id: string, entityId: string, data: Partial<Article>): Promise<Article | null> {
  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  const fields = ['title', 'body', 'category', 'published', 'language', 'sort_order', 'slug'] as const
  for (const field of fields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = $${idx++}`)
      params.push(data[field])
    }
  }

  // Auto-update slug if title changed and slug not explicitly set
  if (data.title && data.slug === undefined) {
    sets.push(`slug = $${idx++}`)
    params.push(generateSlug(data.title))
  }

  params.push(id, entityId)
  const result = await pool.query(
    `UPDATE chat_knowledge_articles SET ${sets.join(', ')} WHERE id = $${idx++} AND entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

export async function deleteArticle(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM chat_knowledge_articles WHERE id = $1 AND entity_id = $2',
    [id, entityId]
  )
  return (result.rowCount || 0) > 0
}

export async function searchArticles(entityId: string, query: string): Promise<Article[]> {
  const result = await pool.query(
    `SELECT * FROM chat_knowledge_articles
     WHERE entity_id = $1 AND published = TRUE
       AND (to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', $2)
            OR title ILIKE '%' || $2 || '%')
     ORDER BY ts_rank(to_tsvector('english', title || ' ' || body), plainto_tsquery('english', $2)) DESC
     LIMIT 10`,
    [entityId, query]
  )
  return result.rows
}
