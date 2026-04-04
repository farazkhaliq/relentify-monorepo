import pool from '../../pool'

export interface Channel {
  id: string
  entity_id: string
  channel_type: string
  config: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export async function getChannels(entityId: string): Promise<Channel[]> {
  const result = await pool.query('SELECT * FROM connect_channels WHERE entity_id = $1 ORDER BY channel_type', [entityId])
  return result.rows
}

export async function getChannelByType(entityId: string, channelType: string): Promise<Channel | null> {
  const result = await pool.query(
    'SELECT * FROM connect_channels WHERE entity_id = $1 AND channel_type = $2',
    [entityId, channelType]
  )
  return result.rows[0] || null
}

export async function upsertChannel(entityId: string, channelType: string, config: Record<string, any>, enabled = true): Promise<Channel> {
  const result = await pool.query(
    `INSERT INTO connect_channels (entity_id, channel_type, config, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_id, channel_type) DO UPDATE SET config = $3, enabled = $4, updated_at = NOW()
     RETURNING *`,
    [entityId, channelType, JSON.stringify(config), enabled]
  )
  return result.rows[0]
}

export async function deleteChannel(id: string, entityId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM connect_channels WHERE id = $1 AND entity_id = $2', [id, entityId])
  return (result.rowCount || 0) > 0
}

export async function findEntityByChannelConfig(channelType: string, matchField: string, matchValue: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT entity_id FROM connect_channels WHERE channel_type = $1 AND config->>$2 = $3 AND enabled = TRUE LIMIT 1`,
    [channelType, matchField, matchValue]
  )
  return result.rows[0]?.entity_id || null
}
