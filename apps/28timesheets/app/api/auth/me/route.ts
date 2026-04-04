import { NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { query } from '@/src/lib/db'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entity = await getActiveEntity(auth.userId)

  const userResult = await query(
    `SELECT id, full_name, email, user_type FROM users WHERE id = $1`,
    [auth.userId]
  )
  const user = userResult.rows[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check workspace membership + role
  let role = 'owner'
  let permissions = null
  if (entity) {
    const memberResult = await query(
      `SELECT role, permissions FROM acc_workspace_members
       WHERE owner_user_id = $1 AND member_user_id = $2 AND status = 'active'`,
      [entity.user_id, auth.userId]
    )
    if (memberResult.rows[0]) {
      role = memberResult.rows[0].role || 'staff'
      permissions = memberResult.rows[0].permissions
    } else if (entity.user_id === auth.userId) {
      role = 'owner'
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      userType: user.user_type,
    },
    entity: entity ? { id: entity.id, name: entity.name } : null,
    role,
    permissions,
  })
}
