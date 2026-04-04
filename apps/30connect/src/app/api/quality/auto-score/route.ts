import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getMessages } from '@/lib/services/message.service'
import { updateReview, getReviewById } from '@/lib/services/qa.service'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { conversation_id, review_id } = body
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

  const messages = await getMessages(conversation_id)
  if (messages.length === 0) return NextResponse.json({ error: 'No messages to score' }, { status: 400 })

  const transcript = messages.map(m => `[${m.sender_type}]: ${m.body}`).join('\n')

  // Call AI for scoring (uses platform AI defaults)
  const apiUrl = process.env.AI_DEFAULT_API_URL || 'https://api.openai.com/v1/chat/completions'
  const apiKey = process.env.AI_DEFAULT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Score this customer service conversation on helpfulness, accuracy, tone, resolution (1-5 each). Return JSON: {"helpfulness":N,"accuracy":N,"tone":N,"resolution":N,"overall":N,"feedback":"brief coaching feedback"}' },
          { role: 'user', content: transcript },
        ],
        max_tokens: 200,
      }),
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const aiScore = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

    if (review_id) {
      await updateReview(review_id, user.activeEntityId, { ai_score: aiScore })
    }

    return NextResponse.json({ ai_score: aiScore })
  } catch (err: any) {
    return NextResponse.json({ error: 'AI scoring failed', detail: err.message }, { status: 500 })
  }
}
