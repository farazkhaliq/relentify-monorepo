import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static, API, portal, and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/portal') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'crm.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`

  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  if (!payload) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}
