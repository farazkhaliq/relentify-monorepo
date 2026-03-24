import { verifyAuthToken, AUTH_COOKIE_NAME } from '@relentify/auth'
import { cookies } from 'next/headers'
import db from './db'

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

  // Fetch activeEntityId from DB using Prisma
  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { userType: true } // active_entity_id doesn't exist in our merged schema yet
    })
    
    return {
      ...payload,
      activeEntityId: null // CRM logic for activeEntityId remains to be fully merged if needed
    }
  } catch (err) {
    console.error('Error fetching user active entity:', err)
    return {
      ...payload,
      activeEntityId: null
    }
  }
}
