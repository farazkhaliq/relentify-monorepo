import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/src/lib/auth'
import { getActiveEntity } from '@/src/lib/entity.service'
import { getUserById } from '@/src/lib/user.service'
import { logRecordingUpload, sendSupportEmail, uploadRecordingToStorage } from '@/src/lib/recording.service'

export const runtime = 'nodejs'

const MAX_SIZE = 200 * 1024 * 1024 // 200MB total

// In-memory chunk assembly — keyed by assemblyKey
declare global {
  // eslint-disable-next-line no-var
  var __recordingChunks: Record<string, Buffer[]> | undefined
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const chunk = formData.get('chunk') as File | null
  const chunkIndex = Number(formData.get('chunkIndex') ?? 0)
  const totalChunks = Number(formData.get('totalChunks') ?? 1)
  const filename = (formData.get('filename') as string) || 'recording.webm'
  const description = (formData.get('description') as string) || ''
  const assemblyKey = (formData.get('assemblyKey') as string) || ''

  if (!chunk) return NextResponse.json({ error: 'Missing chunk' }, { status: 400 })
  if (!['video/webm', 'video/mp4'].includes(chunk.type)) {
    return NextResponse.json({ error: 'Invalid MIME type' }, { status: 400 })
  }

  const buffer = Buffer.from(await chunk.arrayBuffer())

  if (!global.__recordingChunks) global.__recordingChunks = {}
  if (!global.__recordingChunks[assemblyKey]) global.__recordingChunks[assemblyKey] = []
  global.__recordingChunks[assemblyKey][chunkIndex] = buffer

  // Not the last chunk — acknowledge and wait
  if (chunkIndex < totalChunks - 1) {
    return NextResponse.json({ received: chunkIndex + 1, total: totalChunks })
  }

  // All chunks received — assemble and store
  const allChunks: Buffer[] = global.__recordingChunks[assemblyKey]
  delete global.__recordingChunks[assemblyKey]

  const totalSize = allChunks.reduce((acc, c) => acc + c.length, 0)
  if (totalSize > MAX_SIZE) {
    return NextResponse.json({ error: 'Recording too large (200MB max)' }, { status: 413 })
  }

  const entity = await getActiveEntity(auth.userId)
  const user = await getUserById(auth.userId)
  const storageKey = await uploadRecordingToStorage(allChunks, filename)

  const recordingId = await logRecordingUpload({
    userId: auth.userId,
    entityId: entity?.id ?? null,
    filename,
    sizeBytes: totalSize,
    storageKey,
    description,
  })

  // Fire-and-forget support email
  sendSupportEmail({
    userEmail: user?.email ?? auth.email ?? 'unknown',
    description,
    recordingId,
  }).catch(console.error)

  return NextResponse.json({ success: true, recordingId })
}
