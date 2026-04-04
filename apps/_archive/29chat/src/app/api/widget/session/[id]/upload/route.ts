import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { getSessionById } from '@/lib/services/session.service'
import { handleFileUpload } from '@/lib/services/upload.service'
import { checkRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() { return corsOptions() }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders })
  }

  try {
    const { id } = await params
    const session = await getSessionById(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders })
    }

    const result = await handleFileUpload(file, session.entity_id)
    return NextResponse.json(result, { status: 201, headers: corsHeaders })
  } catch (err: any) {
    console.error('Widget upload error:', err)
    const status = err.message?.includes('too large') || err.message?.includes('not allowed') ? 400 : 500
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status, headers: corsHeaders })
  }
}
