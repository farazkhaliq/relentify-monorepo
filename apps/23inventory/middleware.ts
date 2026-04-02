import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken, getRedirectUrl, AUTH_COOKIE_NAME } from '@relentify/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Set pathname in headers for server components
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

  if (pathname.startsWith('/confirm') || pathname.startsWith('/api/confirm') || pathname === '/api/health' || pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const publicUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'inventory.relentify.com'}${req.nextUrl.pathname}${req.nextUrl.search}`
  if (!token) return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))

  const payload = await verifyAuthToken(token, process.env.JWT_SECRET || 'fallback-dev-secret')
  
  if (!payload) {
    return NextResponse.redirect(new URL(getRedirectUrl(publicUrl)))
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    }
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|favicon-32x32\\.png|apple-touch-icon\\.png).*)']
}
