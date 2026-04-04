import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

const PORTAL_COOKIE = 'crm_portal_token'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static, API, and asset paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Portal routes — separate auth flow
  if (pathname.startsWith('/portal')) {
    // Public portal pages (login/signup) — allow without auth
    if (pathname === '/portal/login' || pathname === '/portal/signup') {
      return NextResponse.next()
    }
    // Protected portal pages — check for portal cookie
    const portalToken = req.cookies.get(PORTAL_COOKIE)?.value
    if (!portalToken) {
      return NextResponse.redirect(new URL('/portal/login', req.url))
    }
    return NextResponse.next()
  }

  // Staff routes — existing auth check
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'crm.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`

  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  if (!payload) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
