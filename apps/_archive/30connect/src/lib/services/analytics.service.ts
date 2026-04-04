import pool from '../pool'

export async function getAnalytics(entityId: string, from: string, to: string, channel?: string) {
  const channelFilter = channel ? ` AND channel = '${channel}'` : ''

  const [convPerChannel, responseTime, resolutionRate, agentLeaderboard, botRate, voiceStats] = await Promise.all([
    pool.query(
      `SELECT channel, COUNT(*) as count FROM connect_conversations WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3 GROUP BY channel ORDER BY count DESC`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT channel, AVG(EXTRACT(EPOCH FROM (m.created_at - c.created_at))) as avg_seconds
       FROM connect_conversations c
       JOIN connect_messages m ON m.conversation_id = c.id AND m.sender_type IN ('agent','ai','bot')
       WHERE c.entity_id = $1 AND c.created_at BETWEEN $2 AND $3${channelFilter}
         AND m.created_at = (SELECT MIN(created_at) FROM connect_messages WHERE conversation_id = c.id AND sender_type IN ('agent','ai','bot'))
       GROUP BY channel`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT channel,
         COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved,
         COUNT(*) as total
       FROM connect_conversations WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3 GROUP BY channel`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT c.assigned_agent_id as agent_id, u.full_name,
              COUNT(DISTINCT c.id) as conversations, COUNT(m.id) as messages
       FROM connect_conversations c
       JOIN users u ON u.id = c.assigned_agent_id
       LEFT JOIN connect_messages m ON m.conversation_id = c.id AND m.sender_type = 'agent'
       WHERE c.entity_id = $1 AND c.created_at BETWEEN $2 AND $3 AND c.assigned_agent_id IS NOT NULL
       GROUP BY c.assigned_agent_id, u.full_name ORDER BY conversations DESC LIMIT 10`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM connect_bot_sessions bs WHERE bs.conversation_id = c.id AND bs.status = 'completed')) as bot_resolved,
         COUNT(*) as total
       FROM connect_conversations c WHERE c.entity_id = $1 AND c.created_at BETWEEN $2 AND $3`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT COUNT(*) as total_calls,
              AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) as avg_duration,
              AVG(EXTRACT(EPOCH FROM (COALESCE(answered_at, ended_at, NOW()) - started_at))) as avg_wait,
              COUNT(*) FILTER (WHERE status = 'missed') as missed
       FROM chat_calls WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3`,
      [entityId, from, to]
    ),
  ])

  return {
    conversations_per_channel: convPerChannel.rows.map(r => ({ channel: r.channel, count: parseInt(r.count) })),
    response_time_by_channel: responseTime.rows.map(r => ({ channel: r.channel, avg_seconds: parseFloat(r.avg_seconds) || 0 })),
    resolution_rate_by_channel: resolutionRate.rows.map(r => ({
      channel: r.channel, rate: r.total > 0 ? Math.round((parseInt(r.resolved) / parseInt(r.total)) * 100) : 0,
    })),
    agent_leaderboard: agentLeaderboard.rows.map(r => ({ ...r, conversations: parseInt(r.conversations), messages: parseInt(r.messages) })),
    bot_resolution_rate: botRate.rows[0]?.total > 0
      ? Math.round((parseInt(botRate.rows[0].bot_resolved) / parseInt(botRate.rows[0].total)) * 100) : 0,
    voice: {
      total_calls: parseInt(voiceStats.rows[0]?.total_calls || '0'),
      avg_duration_seconds: parseFloat(voiceStats.rows[0]?.avg_duration || '0'),
      avg_wait_seconds: parseFloat(voiceStats.rows[0]?.avg_wait || '0'),
      missed_calls: parseInt(voiceStats.rows[0]?.missed || '0'),
    },
  }
}
