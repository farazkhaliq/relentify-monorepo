import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function POST() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ message: 'Stripe portal integration pending' })
}
