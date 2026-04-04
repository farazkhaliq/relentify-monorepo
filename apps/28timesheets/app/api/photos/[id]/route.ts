import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getPhoto } from '@/src/lib/photo.service'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const buffer = await getPhoto(id)
  if (!buffer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new Response(buffer, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=3600' },
  })
}
