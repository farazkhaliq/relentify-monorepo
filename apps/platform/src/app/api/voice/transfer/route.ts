import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { call_sid, target_agent_id } = body
  if (!call_sid || !target_agent_id) return NextResponse.json({ error: 'call_sid and target_agent_id required' }, { status: 400 })

  // Warm transfer via Twilio — update call with new TwiML
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    if (!accountSid || !authToken) return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })

    const twiml = `<?xml version="1.0"?><Response><Dial><Client>${target_agent_id}</Client></Dial></Response>`
    const params = new URLSearchParams({ Twiml: twiml })

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${call_sid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
