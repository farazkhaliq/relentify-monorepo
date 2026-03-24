import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const COOKIE_NAME = 'relentify_token';

export interface JWTPayload {
  userId: string;
  actorId: string;
  email: string;
  userType: string;
  fullName: string;
  tier?: string;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (!payload.actorId) payload.actorId = payload.userId;
    return payload;
  } catch { return null; }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isWorkspaceMember(auth: JWTPayload): boolean {
  return auth.actorId !== auth.userId;
}
