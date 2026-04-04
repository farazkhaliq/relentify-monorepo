import { NextRequest, NextResponse } from 'next/server'
import { loginPortalUser, PORTAL_COOKIE } from '@/lib/services/crm/portal-auth.service'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const result = await loginPortalUser(email, password)
    if (!result) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json(result.user)
    res.cookies.set(PORTAL_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return res
  } catch (error: any) {
    console.error('Portal login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
