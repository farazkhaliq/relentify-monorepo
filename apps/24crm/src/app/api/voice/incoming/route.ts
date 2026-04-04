import { NextRequest } from 'next/server'
import pool from '@/lib/pool'
import { getVoiceConfig, generateTwiMLInbound, createCallRecord } from '@/lib/services/connect/voice.service'
import { createConversation } from '@/lib/services/connect/conversation.service'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const callSid = formData.get('CallSid') as string

    // Find entity by Twilio phone number
    const configResult = await pool.query(
      'SELECT * FROM chat_voice_config WHERE twilio_phone_number = $1', [to]
    )
    const config = configResult.rows[0]
    if (!config) {
      return new Response('<?xml version="1.0"?><Response><Say>This number is not configured.</Say></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Create conversation + call record
    const conv = await createConversation(config.entity_id, {
      channel: 'voice',
      external_id: callSid,
      contact_phone: from,
      subject: `Inbound call from ${from}`,
    })

    await createCallRecord({
      entity_id: config.entity_id,
      direction: 'inbound',
      caller_number: from,
      callee_number: to,
      twilio_call_sid: callSid,
      conversation_id: conv.id,
    })

    const twiml = generateTwiMLInbound(config)
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
  } catch (err: any) {
    console.error('Voice incoming error:', err)
    return new Response('<?xml version="1.0"?><Response><Say>An error occurred.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
