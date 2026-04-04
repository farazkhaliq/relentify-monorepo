import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const user = await getAuthUser()
  if (!user || !user.activeEntityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Generate Twilio Client token (requires twilio package)
  try {
    const twilio = await import('twilio')
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const appSid = process.env.TWILIO_APP_SID

    if (!accountSid || !authToken || !appSid) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
    }

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant
    const token = new AccessToken(accountSid, process.env.TWILIO_API_KEY || '', process.env.TWILIO_API_SECRET || '', { identity: user.userId })
    const grant = new VoiceGrant({ outgoingApplicationSid: appSid, incomingAllow: true })
    token.addGrant(grant)

    return NextResponse.json({ token: token.toJwt(), identity: user.userId })
  } catch (err: any) {
    return NextResponse.json({ error: 'Twilio token generation failed', detail: err.message }, { status: 500 })
  }
}
