import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import pool from '@/lib/pool';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.user_type, u.active_entity_id, e.name as entity_name
       FROM users u
       LEFT JOIN entities e ON u.active_entity_id = e.id
       WHERE u.id = $1`,
      [auth.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = rows[0];
    // Prefer users.active_entity_id from DB, fall back to auth-resolved entity
    const entityId = user.active_entity_id || auth.activeEntityId;

    return NextResponse.json({
      uid: user.id,
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      userType: user.user_type,
      activeEntityId: entityId,
      organizationId: entityId,
      organizationName: user.entity_name,
    });
  } catch (error) {
    console.error('GET /api/me error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
