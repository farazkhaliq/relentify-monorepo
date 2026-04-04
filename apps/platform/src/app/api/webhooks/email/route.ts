import { NextRequest, NextResponse } from 'next/server'
import { processInboundEmail } from '@/lib/services/connect/email-channel.service'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    await processInboundEmail(payload)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Email webhook error:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }
}
