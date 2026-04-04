import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { verifyApiKey } from '@/lib/services/esign/auth-api'
import { uploadDocument } from '@/lib/services/esign/document'

export async function POST(req: NextRequest) {
  // Accept JWT (dashboard) or API key (service-to-service)
  const user = await getAuthUser()
  const apiKey = !user ? await verifyApiKey(req.headers.get('authorization')) : null
  if (!user && !apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const signingRequestId = formData.get('signingRequestId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (!signingRequestId) {
    return NextResponse.json({ error: 'Missing signingRequestId' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadDocument(buffer, file.name, file.type, signingRequestId)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
