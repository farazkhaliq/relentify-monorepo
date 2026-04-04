import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'

const PORTAL_COOKIE = 'chat_portal_token'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/portal/login', req.url))
  }

  try {
    const payload = verify(token, process.env.JWT_SECRET || 'fallback-dev-secret') as any

    // Create a longer-lived session token (7 days)
    const { sign } = await import('jsonwebtoken')
    const sessionToken = sign(
      { visitor_id: payload.visitor_id, email: payload.email, entity_id: payload.entity_id },
      process.env.JWT_SECRET || 'fallback-dev-secret',
      { expiresIn: '7d' }
    )

    const response = NextResponse.redirect(new URL('/portal/dashboard', req.url))
    response.cookies.set(PORTAL_COOKIE, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    return NextResponse.redirect(new URL('/portal/login?error=invalid_token', req.url))
  }
}
