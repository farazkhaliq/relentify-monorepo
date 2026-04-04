import { NextRequest, NextResponse } from 'next/server'
import { signupPortalUser, PORTAL_COOKIE } from '@/lib/services/portal-auth.service'

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, role, entityId } = await req.json()

    if (!email || !password || !fullName || !role || !entityId) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      )
    }

    if (!['Tenant', 'Landlord'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be Tenant or Landlord.' },
        { status: 400 }
      )
    }

    const result = await signupPortalUser({
      email,
      password,
      fullName,
      role,
      entityId,
    })

    const res = NextResponse.json(result.user, { status: 201 })
    res.cookies.set(PORTAL_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (error: any) {
    console.error('Portal signup error:', error)
    const message = error.message?.includes('already exists')
      ? error.message
      : 'An unexpected error occurred.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
