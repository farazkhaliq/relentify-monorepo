import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPortalToken,
  getPortalUser,
  PORTAL_COOKIE,
} from '@/lib/services/crm/portal-auth.service'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(PORTAL_COOKIE)?.value
    if (!token) {
      return NextResponse.json(null, { status: 401 })
    }

    const payload = await verifyPortalToken(token)
    if (!payload?.portalUserId) {
      return NextResponse.json(null, { status: 401 })
    }

    const user = await getPortalUser(payload.portalUserId)
    if (!user) {
      return NextResponse.json(null, { status: 401 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Portal /me error:', error)
    return NextResponse.json(null, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PORTAL_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
