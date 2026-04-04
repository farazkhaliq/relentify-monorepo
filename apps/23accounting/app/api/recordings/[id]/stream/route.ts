import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getRecordingStorageKey } from '@/src/lib/recording.service'
import { getStorageProvider } from '@/src/lib/storage'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const storageKey = await getRecordingStorageKey(id, auth.userId)
  if (!storageKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const provider = getStorageProvider()

  // Try direct download (Postgres backend)
  let buffer = await provider.download(storageKey)

  // R2 backend: fetch bytes via presigned URL so we proxy them (never expose URL to client)
  if (!buffer) {
    const presignedUrl = await provider.getUrl(storageKey)
    if (!presignedUrl) return NextResponse.json({ error: 'Storage error' }, { status: 500 })
    const r2Response = await fetch(presignedUrl)
    if (!r2Response.ok) return NextResponse.json({ error: 'Storage fetch failed' }, { status: 502 })
    const arrayBuffer = await r2Response.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'video/webm',
      // inline = display in browser, not trigger download
      'Content-Disposition': 'inline',
      // Prevent caching of sensitive content
      'Cache-Control': 'private, no-store',
      // Disallow framing from other origins
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
