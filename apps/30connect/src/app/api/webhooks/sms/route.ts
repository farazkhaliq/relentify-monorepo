import { NextRequest, NextResponse } from 'next/server'
import { processInboundSMS } from '@/lib/services/sms.service'

export async function POST(req: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const formData = await req.formData()
    const payload: Record<string, string> = {}
    formData.forEach((value, key) => { payload[key] = value as string })

    await processInboundSMS(payload)

    // Twilio expects TwiML response
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err: any) {
    console.error('SMS webhook error:', err)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
