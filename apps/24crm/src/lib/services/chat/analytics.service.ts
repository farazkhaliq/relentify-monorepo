import pool from '../../pool'

export interface AnalyticsData {
  session_count: number
  avg_first_response_seconds: number | null
  resolution_rate: number
  csat_average: number | null
  sessions_per_day: { date: string; count: number }[]
  message_breakdown: { sender_type: string; count: number }[]
  agent_leaderboard: { agent_id: string; full_name: string; sessions: number; messages: number }[]
  busiest_hours: { hour: number; count: number }[]
  ai_usage: { ai_replies: number; ai_tokens_in: number; ai_tokens_out: number } | null
  ticket_stats: { total: number; open: number; resolved: number }
}

export async function getAnalytics(entityId: string, from: string, to: string): Promise<AnalyticsData> {
  const [
    sessionCount,
    avgFirstResponse,
    resolutionRate,
    csatAvg,
    sessionsPerDay,
    messageBreakdown,
    agentLeaderboard,
    busiestHours,
    aiUsage,
    ticketStats,
  ] = await Promise.all([
    pool.query(
      'SELECT COUNT(*) FROM chat_sessions WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3',
      [entityId, from, to]
    ),
    pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (m.created_at - s.created_at))) as avg_seconds
       FROM chat_sessions s
       JOIN chat_messages m ON m.session_id = s.id AND m.sender_type IN ('agent', 'ai')
       WHERE s.entity_id = $1 AND s.created_at BETWEEN $2 AND $3
         AND m.created_at = (SELECT MIN(created_at) FROM chat_messages WHERE session_id = s.id AND sender_type IN ('agent', 'ai'))`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved,
         COUNT(*) as total
       FROM chat_sessions WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3`,
      [entityId, from, to]
    ),
    pool.query(
      'SELECT AVG(rating) FROM chat_sessions WHERE entity_id = $1 AND rating IS NOT NULL AND created_at BETWEEN $2 AND $3',
      [entityId, from, to]
    ),
    pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM chat_sessions WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY DATE(created_at) ORDER BY date`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT sender_type, COUNT(*) as count
       FROM chat_messages WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY sender_type`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT s.assigned_agent_id as agent_id, u.full_name,
              COUNT(DISTINCT s.id) as sessions, COUNT(m.id) as messages
       FROM chat_sessions s
       JOIN users u ON u.id = s.assigned_agent_id
       LEFT JOIN chat_messages m ON m.session_id = s.id AND m.sender_type = 'agent'
       WHERE s.entity_id = $1 AND s.created_at BETWEEN $2 AND $3 AND s.assigned_agent_id IS NOT NULL
       GROUP BY s.assigned_agent_id, u.full_name
       ORDER BY sessions DESC LIMIT 10`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
       FROM chat_sessions WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY hour ORDER BY hour`,
      [entityId, from, to]
    ),
    pool.query(
      `SELECT SUM(ai_replies) as ai_replies, SUM(ai_tokens_in) as ai_tokens_in, SUM(ai_tokens_out) as ai_tokens_out
       FROM chat_ai_usage WHERE entity_id = $1`,
      [entityId]
    ),
    pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'open') as open,
              COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved
       FROM chat_tickets WHERE entity_id = $1 AND created_at BETWEEN $2 AND $3`,
      [entityId, from, to]
    ),
  ])

  const resData = resolutionRate.rows[0]
  const rate = resData.total > 0 ? (parseInt(resData.resolved) / parseInt(resData.total)) * 100 : 0

  return {
    session_count: parseInt(sessionCount.rows[0].count),
    avg_first_response_seconds: avgFirstResponse.rows[0]?.avg_seconds ? parseFloat(avgFirstResponse.rows[0].avg_seconds) : null,
    resolution_rate: Math.round(rate),
    csat_average: csatAvg.rows[0]?.avg ? parseFloat(parseFloat(csatAvg.rows[0].avg).toFixed(1)) : null,
    sessions_per_day: sessionsPerDay.rows.map(r => ({ date: r.date, count: parseInt(r.count) })),
    message_breakdown: messageBreakdown.rows.map(r => ({ sender_type: r.sender_type, count: parseInt(r.count) })),
    agent_leaderboard: agentLeaderboard.rows.map(r => ({ ...r, sessions: parseInt(r.sessions), messages: parseInt(r.messages) })),
    busiest_hours: busiestHours.rows.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count) })),
    ai_usage: aiUsage.rows[0]?.ai_replies ? {
      ai_replies: parseInt(aiUsage.rows[0].ai_replies),
      ai_tokens_in: parseInt(aiUsage.rows[0].ai_tokens_in),
      ai_tokens_out: parseInt(aiUsage.rows[0].ai_tokens_out),
    } : null,
    ticket_stats: {
      total: parseInt(ticketStats.rows[0].total),
      open: parseInt(ticketStats.rows[0].open),
      resolved: parseInt(ticketStats.rows[0].resolved),
    },
  }
}
