import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = '/app/uploads'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'bin'
    const fileName = `${randomUUID()}.${ext}`
    const entityDir = join(UPLOAD_DIR, auth.activeEntityId)
    await mkdir(entityDir, { recursive: true })
    const filePath = join(entityDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    return NextResponse.json({
      path: `${auth.activeEntityId}/${fileName}`,
      name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
  } catch (error) {
    console.error('POST /api/uploads error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
