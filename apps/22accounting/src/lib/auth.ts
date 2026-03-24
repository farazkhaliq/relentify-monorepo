import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const COOKIE_NAME = 'relentify_token';
const CLIENT_COOKIE_NAME = 'relentify_client_token';

export interface WorkspacePermissions {
  invoices:  { view: boolean; create: boolean; delete: boolean };
  bills:     { view: boolean; create: boolean; delete: boolean };
  banking:   { view: boolean; reconcile: boolean };
  reports:   { view: boolean };
  settings:  { view: boolean };
  customers: { view: boolean; manage: boolean };
}

export interface JWTPayload {
  userId: string;
  actorId: string;
  email: string;
  userType: string;
  fullName: string;
  workspacePermissions?: WorkspacePermissions;
  subscriptionPlan?: string;
  isAccountantAccess?: boolean;
}

export function isWorkspaceMember(auth: JWTPayload): boolean {
  return auth.actorId !== auth.userId;
}

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function comparePassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
export function generateToken(payload: JWTPayload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); }
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (!payload.actorId) payload.actorId = payload.userId;
    return payload;
  } catch { return null; }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  // Check client impersonation token first (accountant viewing a client's account)
  const clientToken = cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (clientToken) {
    const clientPayload = verifyToken(clientToken);
    if (clientPayload) return clientPayload;
    // Expired client token — fall through to own token
  }
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(token: string) {
  return { 'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${7*24*60*60}` };
}
export function clearAuthCookie() {
  return { 'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0` };
}
export function setClientCookie(token: string) {
  return { 'Set-Cookie': `${CLIENT_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=${8*60*60}` };
}
export function clearClientCookie() {
  return { 'Set-Cookie': `${CLIENT_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Domain=.relentify.com; Max-Age=0` };
}
