import { getChannelByType, findEntityByChannelConfig } from './channel.service'
import { findOrCreateConversation } from './conversation.service'
import { createMessage } from './message.service'

export async function sendSMS(entityId: string, to: string, body: string): Promise<any> {
  const channel = await getChannelByType(entityId, 'sms')
  if (!channel) throw new Error('SMS channel not configured')

  const config = channel.config
  const accountSid = config.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
  const authToken = config.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN
  const fromNumber = config.phone_number || process.env.TWILIO_PHONE_NUMBER

  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Twilio SMS error: ${response.status} ${err}`)
  }

  return response.json()
}

export async function processInboundSMS(payload: any): Promise<void> {
  const { From, To, Body, MessageSid } = payload
  if (!From || !Body) return

  // Find entity by phone number
  const entityId = await findEntityByChannelConfig('sms', 'phone_number', To)
    || (To === process.env.TWILIO_PHONE_NUMBER ? null : null)

  // Fallback: try to find any SMS channel
  if (!entityId) {
    console.log(`[SMS] No entity found for number: ${To}`)
    return
  }

  const conversation = await findOrCreateConversation(entityId, 'sms', From, {
    phone: From,
  })

  await createMessage({
    conversation_id: conversation.id,
    entity_id: entityId,
    channel: 'sms',
    sender_type: 'contact',
    sender_id: From,
    body: Body,
    external_message_id: MessageSid,
  })
}
