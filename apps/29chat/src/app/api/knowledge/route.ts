import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listArticles, createArticle } from '@/lib/services/knowledge.service'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const articles = await listArticles(user.activeEntityId, {
    category: sp.get('category') || undefined,
    published: sp.has('published') ? sp.get('published') === 'true' : undefined,
  })

  return NextResponse.json(articles)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
  }

  const article = await createArticle(user.activeEntityId, body)
  return NextResponse.json(article, { status: 201 })
}
