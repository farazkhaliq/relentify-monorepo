import { findEntityByChannelConfig, getChannelByType } from './channel.service'
import { findOrCreateConversation } from './conversation.service'
import { createMessage } from './message.service'

const WA_API_BASE = 'https://graph.facebook.com/v19.0'

export async function sendMessage(entityId: string, to: string, body: string): Promise<any> {
  const channel = await getChannelByType(entityId, 'whatsapp')
  if (!channel) throw new Error('WhatsApp channel not configured')

  const config = channel.config
  const response = await fetch(`${WA_API_BASE}/${config.phone_number_id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`WhatsApp API error: ${response.status} ${err}`)
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
    const changes = entry?.changes || []
    for (const change of changes) {
      if (change.field !== 'messages') continue

      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      if (!phoneNumberId) continue

      // Find entity by phone_number_id
      const entityId = await findEntityByChannelConfig('whatsapp', 'phone_number_id', phoneNumberId)
      if (!entityId) continue

      const messages = value?.messages || []
      for (const msg of messages) {
        const from = msg.from
        const contactName = value?.contacts?.[0]?.profile?.name || from

        const conversation = await findOrCreateConversation(entityId, 'whatsapp', from, {
          name: contactName,
          phone: from,
        })

        let body = ''
        if (msg.type === 'text') body = msg.text?.body || ''
        else if (msg.type === 'image') body = '[Image]'
        else if (msg.type === 'document') body = '[Document]'
        else if (msg.type === 'audio') body = '[Audio]'
        else if (msg.type === 'video') body = '[Video]'
        else body = `[${msg.type}]`

        await createMessage({
          conversation_id: conversation.id,
          entity_id: entityId,
          channel: 'whatsapp',
          sender_type: 'contact',
          sender_id: from,
          body,
          external_message_id: msg.id,
          metadata: { wa_type: msg.type },
        })
      }
    }
  }
}
