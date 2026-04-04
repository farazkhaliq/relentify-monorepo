import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createPortalSession } from '@/lib/stripe'

export async function POST() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = await createPortalSession(user.activeEntityId)
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
