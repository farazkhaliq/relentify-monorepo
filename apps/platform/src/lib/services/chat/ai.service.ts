import { ChatConfig, getConfig } from './config.service'
import { createMessage, Message, getMessages } from './message.service'
import { searchArticles } from './knowledge.service'
import { incrementUsage } from './ai-usage.service'
import { decryptApiKey } from '../../crypto'
import { assignAgent } from './routing.service'

interface AIConfig {
  apiUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  maxTokens: number
  temperature: number
}

function resolveAIConfig(config: ChatConfig): AIConfig | null {
  // BYOK: entity has their own key
  if (config.ai_api_url && config.ai_api_key_encrypted) {
    return {
      apiUrl: config.ai_api_url,
      apiKey: decryptApiKey(config.ai_api_key_encrypted),
      model: config.ai_model || 'gpt-4o-mini',
      systemPrompt: config.ai_system_prompt || 'You are a helpful customer support assistant.',
      maxTokens: config.ai_max_tokens || 500,
      temperature: Number(config.ai_temperature) || 0.7,
    }
  }

  // Platform default
  const defaultUrl = process.env.AI_DEFAULT_API_URL
  const defaultKey = process.env.AI_DEFAULT_API_KEY
  if (defaultUrl && defaultKey) {
    return {
      apiUrl: defaultUrl,
      apiKey: defaultKey,
      model: config.ai_model || process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini',
      systemPrompt: config.ai_system_prompt || 'You are a helpful customer support assistant.',
      maxTokens: config.ai_max_tokens || 500,
      temperature: Number(config.ai_temperature) || 0.7,
    }
  }

  return null
}

async function generateAIReply(
  messages: { role: string; content: string }[],
  aiConfig: AIConfig
): Promise<{ content: string; tokens_in: number; tokens_out: number }> {
  const response = await fetch(aiConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      max_tokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI API error: ${response.status} ${text}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response.',
    tokens_in: data.usage?.prompt_tokens || 0,
    tokens_out: data.usage?.completion_tokens || 0,
  }
}

export async function handleAIReply(sessionId: string, entityId: string): Promise<void> {
  const config = await getConfig(entityId)
  if (!config || !config.ai_enabled) return

  // Check plan allows AI
  if (config.plan !== 'ai' && config.plan !== 'branding_ai') {
    // Check if platform defaults are available (free tier with platform AI)
    if (!process.env.AI_DEFAULT_API_KEY) return
  }

  const aiConfig = resolveAIConfig(config)
  if (!aiConfig) return

  // Get recent messages
  const recentMessages = await getMessages(sessionId)
  const last20 = recentMessages.slice(-20)

  // Check for escalation keywords in the latest visitor message
  const lastVisitorMsg = [...last20].reverse().find(m => m.sender_type === 'visitor')
  if (lastVisitorMsg && config.ai_escalate_keywords?.length) {
    const bodyLower = lastVisitorMsg.body.toLowerCase()
    const shouldEscalate = config.ai_escalate_keywords.some(kw => bodyLower.includes(kw.toLowerCase()))
    if (shouldEscalate) {
      await createMessage({
        session_id: sessionId,
        entity_id: entityId,
        sender_type: 'system',
        body: 'Connecting you with an agent...',
      })
      await assignAgent(entityId, sessionId)
      return
    }
  }

  // Search knowledge base for context
  let kbContext = ''
  if (lastVisitorMsg) {
    const articles = await searchArticles(entityId, lastVisitorMsg.body)
    if (articles.length > 0) {
      kbContext = '\n\nRelevant knowledge base articles:\n' +
        articles.slice(0, 3).map(a => `- ${a.title}: ${a.body.slice(0, 300)}`).join('\n')
    }
  }

  // Build messages array for AI
  const aiMessages = [
    { role: 'system', content: aiConfig.systemPrompt + kbContext },
    ...last20.map(m => ({
      role: m.sender_type === 'visitor' ? 'user' : 'assistant',
      content: m.body,
    })),
  ]

  try {
    const reply = await generateAIReply(aiMessages, aiConfig)

    await createMessage({
      session_id: sessionId,
      entity_id: entityId,
      sender_type: 'ai',
      body: reply.content,
    })

    await incrementUsage(entityId, reply.tokens_in, reply.tokens_out)
  } catch (err) {
    console.error('AI reply error:', err)
    // Fallback: route to human agent
    await assignAgent(entityId, sessionId)
  }
}
