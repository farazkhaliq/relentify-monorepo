import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getRecordingsForUser } from '@/src/lib/recording.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const recordings = await getRecordingsForUser(auth.userId)
  return NextResponse.json({ recordings })
}
