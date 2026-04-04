import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getUserProfiles } from '@/lib/services/crm/user-profiles.service'

export async function GET() {
  const auth = await getAuthUser()
  if (!auth || !auth.activeEntityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const profiles = await getUserProfiles(auth.activeEntityId)
    return NextResponse.json(profiles)
  } catch (error) {
    console.error('GET /api/user-profiles error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
