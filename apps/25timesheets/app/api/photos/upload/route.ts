import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { storePhoto } from '@/src/lib/photo.service'

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('photo') as File
  const photoType = formData.get('type') as 'clock_in' | 'clock_out'
  const entryId = formData.get('entryId') as string

  if (!file || !photoType || !entryId) {
    return NextResponse.json({ error: 'photo, type, and entryId required' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo must be under 5MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await storePhoto(entryId, photoType, buffer)
  return NextResponse.json(result)
}
