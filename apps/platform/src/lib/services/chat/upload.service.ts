import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_ROOT = '/app/uploads/chat'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}

export async function handleFileUpload(
  file: File,
  entityId: string
): Promise<{ url: string; filename: string; size: number }> {
  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.')
  }

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    throw new Error(`File type ${file.type} is not allowed.`)
  }

  const id = uuidv4()
  const filename = `${id}${ext}`
  const dir = path.join(UPLOAD_ROOT, entityId)

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, filename), buffer)

  return {
    url: `/api/uploads/${entityId}/${filename}`,
    filename: file.name,
    size: file.size,
  }
}
