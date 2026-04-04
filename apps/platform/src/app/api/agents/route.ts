import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import pool from '@/lib/pool'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email
     FROM users u
     JOIN entities e ON e.user_id = u.id
     WHERE e.id = $1`,
    [user.activeEntityId]
  )

  return NextResponse.json(result.rows)
}
