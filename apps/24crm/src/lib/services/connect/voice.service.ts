import pool from '../../pool'
import { createConversation } from './conversation.service'
import { createMessage } from './message.service'

export interface VoiceConfig {
  twilio_account_sid: string | null
  twilio_auth_token_encrypted: string | null
  twilio_phone_number: string | null
  voicemail_enabled: boolean
  recording_enabled: boolean
  ivr_flow: Record<string, any>
  max_queue_wait_seconds: number
}

export async function getVoiceConfig(entityId: string): Promise<VoiceConfig | null> {
  const result = await pool.query('SELECT * FROM chat_voice_config WHERE entity_id = $1', [entityId])
  return result.rows[0] || null
}

export async function upsertVoiceConfig(entityId: string, data: Partial<VoiceConfig>): Promise<VoiceConfig> {
  const existing = await getVoiceConfig(entityId)
  if (!existing) {
    const result = await pool.query(
      `INSERT INTO chat_voice_config (entity_id, twilio_account_sid, twilio_phone_number, voicemail_enabled, recording_enabled, ivr_flow, max_queue_wait_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entityId, data.twilio_account_sid || null, data.twilio_phone_number || null,
       data.voicemail_enabled ?? true, data.recording_enabled ?? true,
       JSON.stringify(data.ivr_flow || {}), data.max_queue_wait_seconds || 300]
    )
    return result.rows[0]
  }

  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  if (data.twilio_account_sid !== undefined) { sets.push(`twilio_account_sid = $${idx++}`); params.push(data.twilio_account_sid) }
  if (data.twilio_phone_number !== undefined) { sets.push(`twilio_phone_number = $${idx++}`); params.push(data.twilio_phone_number) }
  if (data.voicemail_enabled !== undefined) { sets.push(`voicemail_enabled = $${idx++}`); params.push(data.voicemail_enabled) }
  if (data.recording_enabled !== undefined) { sets.push(`recording_enabled = $${idx++}`); params.push(data.recording_enabled) }
  if (data.ivr_flow !== undefined) { sets.push(`ivr_flow = $${idx++}`); params.push(JSON.stringify(data.ivr_flow)) }
  if (data.max_queue_wait_seconds !== undefined) { sets.push(`max_queue_wait_seconds = $${idx++}`); params.push(data.max_queue_wait_seconds) }

  params.push(entityId)
  const result = await pool.query(
    `UPDATE chat_voice_config SET ${sets.join(', ')} WHERE entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0]
}

export function generateTwiMLInbound(config: VoiceConfig, agentId?: string): string {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>'

  // IVR if configured
  const ivr = config.ivr_flow
  if (ivr && ivr.greeting) {
    twiml += `<Gather numDigits="1" action="/api/voice/incoming?step=ivr_choice"><Say>${escXml(ivr.greeting)}</Say></Gather>`
  }

  // Connect to agent or queue
  if (agentId) {
    twiml += `<Dial><Client>${escXml(agentId)}</Client></Dial>`
  } else {
    twiml += `<Say>Please hold while we connect you with an agent.</Say>`
    twiml += `<Enqueue waitUrl="/api/voice/incoming?step=wait_music">support</Enqueue>`
  }

  // Voicemail fallback
  if (config.voicemail_enabled) {
    twiml += `<Say>We are unable to take your call right now. Please leave a message after the beep.</Say>`
    twiml += `<Record maxLength="120" action="/api/voice/status?type=voicemail" />`
  }

  twiml += '</Response>'
  return twiml
}

export async function createCallRecord(data: {
  entity_id: string; direction: string; caller_number?: string; callee_number?: string;
  agent_id?: string; twilio_call_sid?: string; conversation_id?: string
}): Promise<any> {
  const result = await pool.query(
    `INSERT INTO chat_calls (entity_id, direction, caller_number, callee_number, agent_id, twilio_call_sid, conversation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.entity_id, data.direction, data.caller_number || null, data.callee_number || null,
     data.agent_id || null, data.twilio_call_sid || null, data.conversation_id || null]
  )
  return result.rows[0]
}

export async function updateCallRecord(callSid: string, data: {
  status?: string; recording_url?: string; recording_duration_seconds?: number;
  voicemail_url?: string; answered_at?: string; ended_at?: string
}): Promise<any> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.status) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.recording_url) { sets.push(`recording_url = $${idx++}`); params.push(data.recording_url) }
  if (data.recording_duration_seconds) { sets.push(`recording_duration_seconds = $${idx++}`); params.push(data.recording_duration_seconds) }
  if (data.voicemail_url) { sets.push(`voicemail_url = $${idx++}`); params.push(data.voicemail_url) }
  if (data.answered_at) { sets.push(`answered_at = $${idx++}`); params.push(data.answered_at) }
  if (data.ended_at) { sets.push(`ended_at = $${idx++}`); params.push(data.ended_at) }

  if (sets.length === 0) return null
  params.push(callSid)
  const result = await pool.query(
    `UPDATE chat_calls SET ${sets.join(', ')} WHERE twilio_call_sid = $${idx} RETURNING *`,
    params
  )
  return result.rows[0] || null
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
