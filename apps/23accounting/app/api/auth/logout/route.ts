import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/src/lib/auth';
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', clearAuthCookie()['Set-Cookie']);
  return res;
}
