import pool from '../pool'

export interface ChatConfig {
  id: string
  entity_id: string
  widget_colour: string
  widget_position: string
  widget_greeting: string
  widget_offline_message: string
  widget_avatar_url: string | null
  widget_show_branding: boolean
  widget_i18n: Record<string, any>
  pre_chat_form_enabled: boolean
  pre_chat_fields: string[]
  business_name: string | null
  business_timezone: string
  business_description: string | null
  operating_hours: Record<string, any>
  departments: any[]
  ai_enabled: boolean
  ai_api_url: string | null
  ai_api_key_encrypted: string | null
  ai_model: string
  ai_system_prompt: string
  ai_max_tokens: number
  ai_temperature: number
  ai_auto_reply: boolean
  ai_escalate_keywords: string[]
  routing_method: string
  auto_assign: boolean
  canned_responses: any[]
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string
  created_at: string
  updated_at: string
}

const PUBLIC_FIELDS = [
  'widget_colour', 'widget_position', 'widget_greeting', 'widget_offline_message',
  'widget_avatar_url', 'widget_show_branding', 'widget_i18n',
  'pre_chat_form_enabled', 'pre_chat_fields',
  'operating_hours', 'departments', 'business_name',
]

export async function getConfig(entityId: string): Promise<ChatConfig | null> {
  const result = await pool.query('SELECT * FROM chat_config WHERE entity_id = $1', [entityId])
  return result.rows[0] || null
}

export async function getPublicConfig(entityId: string): Promise<Record<string, any> | null> {
  const config = await getConfig(entityId)
  if (!config) return null

  const publicConfig: Record<string, any> = {}
  for (const field of PUBLIC_FIELDS) {
    publicConfig[field] = (config as any)[field]
  }
  return publicConfig
}

export async function ensureConfig(entityId: string): Promise<ChatConfig> {
  const existing = await getConfig(entityId)
  if (existing) return existing

  const result = await pool.query(
    'INSERT INTO chat_config (entity_id) VALUES ($1) ON CONFLICT (entity_id) DO NOTHING RETURNING *',
    [entityId]
  )
  if (result.rows[0]) return result.rows[0]

  // Race condition: another request created it
  return (await getConfig(entityId))!
}

export async function upsertConfig(entityId: string, data: Partial<ChatConfig>): Promise<ChatConfig> {
  await ensureConfig(entityId)

  const allowedFields = [
    'widget_colour', 'widget_position', 'widget_greeting', 'widget_offline_message',
    'widget_avatar_url', 'widget_show_branding', 'widget_i18n',
    'pre_chat_form_enabled', 'pre_chat_fields',
    'business_name', 'business_timezone', 'business_description',
    'operating_hours', 'departments',
    'ai_enabled', 'ai_api_url', 'ai_api_key_encrypted', 'ai_model',
    'ai_system_prompt', 'ai_max_tokens', 'ai_temperature', 'ai_auto_reply', 'ai_escalate_keywords',
    'routing_method', 'auto_assign', 'canned_responses',
  ]

  const sets: string[] = ['updated_at = NOW()']
  const params: any[] = []
  let idx = 1

  for (const field of allowedFields) {
    if ((data as any)[field] !== undefined) {
      sets.push(`${field} = $${idx++}`)
      const val = (data as any)[field]
      params.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
    }
  }

  params.push(entityId)
  const result = await pool.query(
    `UPDATE chat_config SET ${sets.join(', ')} WHERE entity_id = $${idx} RETURNING *`,
    params
  )
  return result.rows[0]
}
