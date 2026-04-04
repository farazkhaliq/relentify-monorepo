import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'
const COOKIE_NAME = 'relentify_token'

export interface TimesheetPermissions {
  timesheets: { view: boolean; create: boolean; approve: boolean }
  scheduling: { view: boolean; create: boolean; assign: boolean }
  reports:    { view: boolean; export: boolean }
  settings:   { view: boolean; manage: boolean }
  team:       { view: boolean; manage: boolean }
  sites:      { view: boolean; manage: boolean }
}

export interface JWTPayload {
  userId: string
  actorId: string
  email: string
  userType: string
  fullName: string
  workspacePermissions?: TimesheetPermissions
  subscriptionPlan?: string
}

export function generateToken(payload: JWTPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload
    if (!payload.actorId) payload.actorId = payload.userId
    return payload
  } catch {
    return null
  }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function setAuthCookie(token: string) {
  return {
    'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${7 * 24 * 60 * 60}`,
  }
}

export function clearAuthCookie() {
  return {
    'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0`,
  }
}
