import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

const UPLOAD_DIR = '/app/uploads'

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv', txt: 'text/plain', zip: 'application/zip',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const auth = await getAuthUser()
  if (!auth?.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path: pathSegments } = await params
  const filePath = join(UPLOAD_DIR, ...pathSegments)

  // Ensure user can only access their own entity's files
  if (!filePath.startsWith(join(UPLOAD_DIR, auth.activeEntityId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await stat(filePath)
    const buffer = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
    return new NextResponse(buffer, { headers: { 'Content-Type': mimeType } })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
