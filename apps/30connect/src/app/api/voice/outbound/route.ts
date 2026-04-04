import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createCallRecord } from '@/lib/services/voice.service'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { to, conversation_id } = body
  if (!to) return NextResponse.json({ error: 'to number required' }, { status: 400 })

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
    }

    // Initiate call via Twilio REST API
    const params = new URLSearchParams({
      To: to,
      From: fromNumber,
      Url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/incoming`,
      StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/status`,
    })

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )

    const data = await response.json()

    const call = await createCallRecord({
      entity_id: user.activeEntityId,
      direction: 'outbound',
      callee_number: to,
      caller_number: fromNumber,
      agent_id: user.userId,
      twilio_call_sid: data.sid,
      conversation_id,
    })

    return NextResponse.json(call, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
