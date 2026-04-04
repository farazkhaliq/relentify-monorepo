import type { Pool } from 'pg'
import type { ChatConfig } from '../types'

export function createConfigService(pool: Pool) {
  return {
    async getConfig(entityId: string): Promise<ChatConfig | null> {
      const result = await pool.query('SELECT * FROM chat_config WHERE entity_id = $1', [entityId])
      return result.rows[0] || null
    },

    async ensureConfig(entityId: string): Promise<ChatConfig> {
      const existing = await pool.query('SELECT * FROM chat_config WHERE entity_id = $1', [entityId])
      if (existing.rows[0]) return existing.rows[0]
      const result = await pool.query('INSERT INTO chat_config (entity_id) VALUES ($1) ON CONFLICT (entity_id) DO NOTHING RETURNING *', [entityId])
      if (result.rows[0]) return result.rows[0]
      return (await pool.query('SELECT * FROM chat_config WHERE entity_id = $1', [entityId])).rows[0]
    },

    async upsertConfig(entityId: string, data: Partial<ChatConfig>): Promise<ChatConfig> {
      // Ensure exists first
      await pool.query('INSERT INTO chat_config (entity_id) VALUES ($1) ON CONFLICT DO NOTHING', [entityId])
      const allowedFields = ['widget_colour', 'widget_position', 'widget_greeting', 'widget_offline_message',
        'widget_show_branding', 'business_name', 'business_timezone', 'ai_enabled', 'ai_model',
        'ai_system_prompt', 'ai_max_tokens', 'ai_temperature', 'routing_method', 'auto_assign', 'canned_responses']
      const sets: string[] = ['updated_at = NOW()']; const params: any[] = []; let idx = 1
      for (const f of allowedFields) {
        if ((data as any)[f] !== undefined) {
          sets.push(`${f} = $${idx++}`)
          const val = (data as any)[f]
          params.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val)
        }
      }
      params.push(entityId)
      const result = await pool.query(`UPDATE chat_config SET ${sets.join(', ')} WHERE entity_id = $${idx} RETURNING *`, params)
      return result.rows[0]
    },
  }
}
