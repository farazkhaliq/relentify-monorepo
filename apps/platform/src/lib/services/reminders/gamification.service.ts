import pool from '../../pool';

export async function awardPoints(userId: string, points: number) {
  const sql = `
    INSERT INTO reminders_gamification (user_id, points, streak_count, last_completed_at)
    VALUES ($1, $2, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      points = reminders_gamification.points + $2,
      streak_count = CASE 
        WHEN reminders_gamification.last_completed_at > NOW() - INTERVAL '24 hours' THEN reminders_gamification.streak_count + 1
        ELSE 1
      END,
      last_completed_at = NOW()
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [userId, points]);
  return rows[0];
}

export async function getLeaderboard(limit = 10) {
  const { rows } = await pool.query(
    `SELECT g.*, u.full_name as user_name
     FROM reminders_gamification g
     JOIN users u ON g.user_id = u.id
     ORDER BY g.points DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
