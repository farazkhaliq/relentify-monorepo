import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'
const COOKIE_NAME = 'relentify_token'
export interface JWTPayload { userId: string; email: string; userType: string; fullName: string; tier?: string }
export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12) }
export async function comparePassword(pw: string, hash: string) { return bcrypt.compare(pw, hash) }
export function generateToken(payload: JWTPayload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }) }
export function verifyToken(token: string): JWTPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as JWTPayload } catch { return null }
}
export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
export function setAuthCookie(token: string) {
  return {
    'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${7 * 24 * 60 * 60}`
  }
}
export function clearAuthCookie() {
  return {
    'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0`
  }
}