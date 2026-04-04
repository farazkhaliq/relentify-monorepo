import { findEntityByChannelConfig, getChannelByType } from './channel.service'
import { findOrCreateConversation } from './conversation.service'
import { createMessage } from './message.service'

const FB_API_BASE = 'https://graph.facebook.com/v19.0'

export async function sendMessage(entityId: string, recipientId: string, text: string, platform: 'facebook' | 'instagram' = 'facebook'): Promise<any> {
  const channel = await getChannelByType(entityId, platform)
  if (!channel) throw new Error(`${platform} channel not configured`)

  const config = channel.config
  const response = await fetch(`${FB_API_BASE}/${config.page_id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.page_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`${platform} API error: ${response.status} ${err}`)
  }

  return response.json()
}

export function verifyWebhook(query: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string }, verifyToken: string): string | null {
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === verifyToken) {
    return query['hub.challenge'] || null
  }
  return null
}

export async function processWebhook(payload: any): Promise<void> {
  const entries = payload?.entry || []

  for (const entry of entries) {
    const messaging = entry?.messaging || []
    const pageId = entry.id

    for (const event of messaging) {
      if (!event.message) continue

      const senderId = event.sender?.id
      if (!senderId || senderId === pageId) continue

      // Determine if this is Facebook or Instagram
      const isInstagram = !!entry.instagram_business_account
      const platform = isInstagram ? 'instagram' : 'facebook'

      const entityId = await findEntityByChannelConfig(platform, 'page_id', pageId)
      if (!entityId) continue

      const conversation = await findOrCreateConversation(entityId, platform, senderId, {
        name: event.sender?.name,
      })

      const body = event.message.text || '[Attachment]'

      await createMessage({
        conversation_id: conversation.id,
        entity_id: entityId,
        channel: platform,
        sender_type: 'contact',
        sender_id: senderId,
        body,
        external_message_id: event.message.mid,
      })
    }
  }
}
