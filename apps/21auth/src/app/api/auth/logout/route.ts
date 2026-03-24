import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/src/lib/auth'

export async function GET() {
  const res = NextResponse.redirect('https://auth.relentify.com/login')
  res.headers.set('Set-Cookie', clearAuthCookie()['Set-Cookie'])
  return res
}
