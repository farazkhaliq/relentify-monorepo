import { verifyAuthToken, AUTH_COOKIE_NAME } from '@relentify/auth'
import { cookies } from 'next/headers'
import pool from './pool'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'

export interface JWTPayload {
  userId: string
  email: string
  userType: string
  fullName: string
}

export interface AuthUser extends JWTPayload {
  activeEntityId: string | null
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyAuthToken(token, JWT_SECRET)
  return payload as unknown as JWTPayload
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  try {
    const result = await pool.query(
      'SELECT id FROM entities WHERE user_id = $1 LIMIT 1',
      [payload.userId]
    )
    const activeEntityId = result.rows[0]?.id || null

    return {
      ...payload,
      activeEntityId,
    }
  } catch (err) {
    console.error('Error fetching user active entity:', err)
    return {
      ...payload,
      activeEntityId: null,
    }
  }
}
