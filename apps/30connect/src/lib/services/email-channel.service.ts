import { findEntityByChannelConfig, getChannelByType } from './channel.service'
import { findOrCreateConversation } from './conversation.service'
import { createMessage } from './message.service'

export async function sendEmail(entityId: string, to: string, subject: string, body: string): Promise<any> {
  const channel = await getChannelByType(entityId, 'email')
  if (!channel) throw new Error('Email channel not configured')

  const config = channel.config
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resend_api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.from_name || 'Support'} <${config.from_address}>`,
      to: [to],
      subject,
      text: body,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Resend API error: ${response.status} ${err}`)
  }

  return response.json()
}

export async function processInboundEmail(payload: any): Promise<void> {
  const { from, to, subject, text, html, message_id, in_reply_to } = payload

  if (!to || !from) return

  // Find entity by inbound address
  const toAddress = Array.isArray(to) ? to[0] : to
  const entityId = await findEntityByChannelConfig('email', 'inbound_address', toAddress)
  if (!entityId) {
    console.log(`[Email] No entity found for inbound address: ${toAddress}`)
    return
  }

  // Thread matching: use in_reply_to or from address as external_id
  const threadId = in_reply_to || from
  const senderEmail = typeof from === 'string' ? from : from?.address || from

  const conversation = await findOrCreateConversation(entityId, 'email', threadId, {
    email: senderEmail,
    name: typeof from === 'object' ? from.name : undefined,
  })

  // Update subject if this is a new conversation
  if (subject && !conversation.subject) {
    const pool = (await import('../pool')).default
    await pool.query('UPDATE connect_conversations SET subject = $1 WHERE id = $2', [subject, conversation.id])
  }

  await createMessage({
    conversation_id: conversation.id,
    entity_id: entityId,
    channel: 'email',
    sender_type: 'contact',
    sender_id: senderEmail,
    body: text || html || '(empty)',
    external_message_id: message_id,
    metadata: { subject, has_html: !!html },
  })
}
