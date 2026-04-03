import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

  // Public routes — no auth required
  if (
    pathname.startsWith('/s/') ||
    pathname.startsWith('/api/sign/') ||
    pathname.startsWith('/api/v1/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/documents/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/certificate/')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Agent dashboard routes — require JWT auth
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'esign.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`

  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  if (!payload) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg).*)']
}
